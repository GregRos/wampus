import {WampArray, WampMessage, WampPrimitive, WampRawMessage} from "../protocol/messages";
import {WebsocketTransport} from "../transport/websocket";
import {WampusError, WampusNetworkError} from "../errors/types";
import {PrefixRoute, PrefixRouter} from "./prefix-router";
import {Transport, TransportMessage} from "../transport/transport";
import {Errs} from "../errors/errors";
import {MessageReader} from "../protocol/reader";
import {merge, Observable, of, Subject} from "rxjs";
import {flatMap, take, tap} from "rxjs/operators";
import {MyPromise} from "../../utils/ext-promise";
import {WampusRouteCompletion} from "../session/route-completion";

/**
 * A message-based WAMP protocol client that allows sending WAMP messages and receiving them.
 */
export class WampProtocolClient<T> {
    transport : Transport;
    private _onClosed = new Subject<object>();
    private _onUnknownMessage = new Subject<any>();
    public _router : PrefixRouter<T>;
    private _parser : (x : WampRawMessage) => T;
    /**
     * Use [[WampProtocolClient.create]].
     * @param {never} never
     */
    constructor(never : never) {

    }

    /**
     * Creates an instance of the [[WampProtocolClient]].
     * @param transport The transport used to send and receive messages.
     * @param selector Used to transform messages from a raw array format to an object format.
     * @returns WampProtocolClient<T>
     */
    static create<T>(transport : Transport, selector : (x : WampRawMessage) => T) : WampProtocolClient<T> {
        let messenger = new WampProtocolClient<T>(null as never);
        messenger.transport = transport;
        messenger._parser = selector;
        let router = messenger._router = new PrefixRouter<T>();
        messenger._setupRouter();
        return messenger;
    }

    private _defaultRoute : PrefixRoute<any> = {
        key : [],
        error(err) {
            console.error(err);
        },
        next : (x) => {
            this._onUnknownMessage.next(x);
        }
    };

	/**
	 * An observable that notifies when the underlying transport is closed.
	 */
	public get onClosed() {
        return this._onClosed.asObservable();
    }


    private _setupRouter() {
        this.transport.events$.subscribe({
            next: x => {
                if (x.type === "error") {
                    let all = this._router.matchAll();
                    if (all.length === 0) {
                        this._defaultRoute.error(x.data);
                    } else {
                        all.forEach(route => route.error(x.data));
                    }
                } else if (x.type === "message") {
                	if (!(Array.isArray(x.data))) {
                		throw new WampusNetworkError("Non-array message.", {})
	                }
                    let msg = this._parser(x.data);
                    let routes = this._router.match(x.data);
                    routes.forEach(route => route.next(msg));
                    if (routes.length === 0) {
                        this._defaultRoute.next(msg);
                    }
                } else if (x.type === "closed") {
                    this._onClosed.next(x.data);
                    this._onClosed.complete();

                }
            },
            complete: () => {

            },
            error: (err) => {
                 this._defaultRoute.error(err);
            }
        });
    }

    /**
     * Creates a cold observable that, when subscribed to, will send the given WAMP message via the transport and complete once the message has been sent.
     * @param {WampMessage.Any} msg The message to send.
     */
    send$(msg : T & {toTransportFormat() : WampRawMessage}) : Observable<any> {
        return of(null).pipe(flatMap(() => {
	        let loose = msg.toTransportFormat();
	        return this.transport.send$(loose);
        }));
    }

    /**
     * When subscribed to, creates a route for all protocol messages.
     * When unsubscribed, deletes the route.
     * @returns {Observable<WampMessage.Any>}
     */
    get messages$() {
        return merge(this.expect$([]));
    }

    /**
     * When subscribed to, creates a route for protocol messages with fields matching the given prefix.
     * When unsubscribed, deletes the route.
     * @param {WampArray} prefixKey
     * @returns {Observable<WampMessage.Any>}
     */
    expect$(prefixKey : WampPrimitive[]) : Observable<T> {
        return Observable.create(sub => {
            let inv = {
                key : prefixKey,
                next(x) {
                    sub.next(x);
                },
                complete() {
                    sub.complete();
                },
                error(err) {
                    sub.error(err);
                }
            };
            this._router.insertRoute(inv);
            return {
                 unsubscribe : async () => {
                    this._router.removeRoute(inv);
                }
            }
        });
    }

    /**
     * When called, it will invalidate all existing routes by causing them to error with the given object.
     * This should be used when terminating a session in order to violate all routes.
     * @param error
     */
    invalidateAllRoutes(error : Error) {
        // The wait(0) thing is needed to prevent a bug in rxjs where it seems that
        // causing a source observable to error while in a flatMap will hang the observable
        // TODO: Report bug
        MyPromise.wait(0).then(() => {
            this._onClosed.complete();
            let routes = this._router.matchAll();
            for (let route of routes){
                route.error(error);
            }
        });

    }

    /**
     * Like [[expect$]], except that this defines several routes with a union.
     * @see expect$
     * @param routes
     */
    expectAny$<T>(...routes : WampPrimitive[][]) {
        return merge(...routes.map(rt => this.expect$(rt)));
    }
}