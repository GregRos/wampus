import {WampArray, WampMessage, WampusRouteCompletion} from "./messages";
import {WebsocketTransport} from "../transport/websocket";
import {WampusNetworkError} from "../errors/types";
import {PrefixRoute, PrefixRouter} from "../routing/prefix-router";
import {Transport, TransportMessage} from "../transport/transport";
import {Errs} from "../errors/errors";
import {MessageReader} from "./reader";
import {merge, Observable, of, Subject} from "rxjs";
import {flatMap, take, tap} from "rxjs/operators";
import {MyPromise} from "../../ext-promise";

/**
 * A message-based WAMP protocol client that allows sending WAMP messages and receiving them.
 */
export class WampProtocolClient<T> {
    transport : Transport;
    private _onClosed = new Subject<object>();
    private _onUnknownMessage = new Subject<any>();
    public _router : PrefixRouter<T>;
    private _selector : (x : WampArray) => T;
    /**
     * Use [[WampProtocolClient.create]].
     * @param {never} never
     */
    constructor(never : never) {

    }

    /**
     * Creates an instance of the WampProtocolClient
     * @returns {Observable<WampProtocolClient>}
     */
    static create<T>(transport : Transport, selector : (x : WampArray) => T) : WampProtocolClient<T> {
        let messenger = new WampProtocolClient<T>(null as never);
        messenger.transport = transport;
        messenger._selector = selector;
        let router = messenger._router = new PrefixRouter<T>();
        messenger._setupRouter();
        return messenger;
    }

    private _defaultRoute : PrefixRoute<any> = {
        keys : [],
        error(err) {
            console.error(err);
        },
        next : (x) => {
            this._onUnknownMessage.next(x);
        }
    };

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
                    let msg = this._selector(x.data);
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
                //TODO: Report errors here
            }
        });
    }

    /**
     * Creates a cold observable that, when subscribed to, will send the given WAMP message via the transport and complete once the message has been sent.
     * @param {WampMessage.Any} msg The message to send.
     */
    send$(msg : WampMessage.Any) : Observable<any> {
        return of(null).pipe(flatMap(() => {
            if ("toTransportFormat" in msg) {
                let loose = msg.toTransportFormat();
                return this.transport.send$(loose);
            } else {
                throw new WampusNetworkError("Wampus doesn't know how to serialize this kind of message.", {
                    type : msg.type
                });
            }
        }));
    }

    /**
     * Creates an observable that will yield the next transport message when subscribed to.
     * If the transport errors or closes before a message is received, the observable will error.
     * @returns {Observable<WampMessage.Any>}
     */
    expectNext$() {
        return merge(this.expect$([]), this.onClosed.pipe(tap(x => {
            //TODO: Better handling of abrupt disconnect by server
            throw new WampusNetworkError("Connection abruptly closed.");
        }))).pipe(take(1))
    }

    /**
     * An observable that, when subscribed to, will create an entry in the routing table for messages with the given prefix key.
     * The subscription will fire whenever a matching the prefix key arrives. This is used to receive messages of a certain type.
     * @param {WampArray} prefixKey
     * @returns {Observable<WampMessage.Any>}
     */
    expect$(prefixKey : WampArray) : Observable<T> {
        return Observable.create(sub => {
            let inv = {
                keys : prefixKey,
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
     * @param error
     */
    invalidateAllRoutes(error : Error) {
        // The timer(0) thing is needed to prevent a bug in rxjs where it seems that
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
     * Like [[expect$]], except that this will create several routes at the same time.
     * @see expect$
     * @param routes
     */
    expectAny$<T>(...routes : WampArray[]) {
        return merge(...routes.map(rt => this.expect$(rt)));
    }
}