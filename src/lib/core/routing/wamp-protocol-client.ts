import {WampArray, Wamp, WampPrimitive, WampRaw} from "typed-wamp";
import {WampusNetworkError} from "../errors/types";
import {PrefixRoute, PrefixRouter} from "./prefix-router";
import {Transport} from "../transport/transport";
import {defer, EMPTY, merge, Observable, Subject} from "rxjs";

/**
 * A message-based WAMP protocol client that allows sending WAMP messages and receiving them.
 */
export class WampProtocolClient<T> {
    transport: Transport;
    _router: PrefixRouter<T>;
    private _onUnknownMessage = new Subject<any>();
    private _parser: (x: WampRaw.Unknown) => T;
    private _defaultRoute: PrefixRoute<any> = {
        key: [],
        error(err) {
            console.error(err);
        },
        next:x => {
            this._onUnknownMessage.next(x);
        }
    };

    /**
     * Use {@link  WampProtocolClient.connect}.
     */
    private constructor() {

    }

    private _onClosed = new Subject<object>();

    /**
     * An observable that notifies when the underlying transport is closed.
     */
    public get onClosed() {
        return this._onClosed.asObservable();
    }

    /**
     * When subscribed to, creates a route for all protocol messages.
     * When unsubscribed, deletes the route.
     * @returns {Observable<Wamp.Any>}
     */
    get messages$() {
        return merge(this.expect$([]));
    }

    /**
     * Creates an instance of the {@link  WampProtocolClient}.
     * @param transport The transport used to send and receive messages.
     * @param selector Used to transform messages from a raw array format to an object format.
     * @returns WampProtocolClient<T>
     */
    static create<T>(transport: Transport, selector: (x: WampRaw.Unknown) => T): WampProtocolClient<T> {
        let messenger = new WampProtocolClient<T>();
        messenger.transport = transport;
        messenger._parser = selector;
        messenger._router = new PrefixRouter<T>();
        messenger._setupRouter();
        return messenger;
    }

    /**
     * Creates a cold observable that, when subscribed to, will send the given WAMP message via the transport and complete once the message has been sent.
     * @param {Wamp.Any} msg The message to send.
     */
    send$(msg: Wamp.Any): Observable<any> {
        return defer(() => {
            let loose = msg.toRaw();
            return this.transport.send$(loose);
        });
    }

    /**
     * When subscribed to, creates a route for protocol messages with fields matching the given prefix.
     * When unsubscribed, deletes the route.
     * @param {WampArray} prefixKey
     * @returns {Observable<Wamp.Any>}
     */
    expect$(prefixKey: WampPrimitive[]): Observable<T> {
        return new Observable(sub => {
            let inv = {
                key: prefixKey,
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
                unsubscribe: async () => {
                    this._router.removeRoute(inv);
                }
            };
        });
    }

    /**
     * When called, it will invalidate all existing routes by causing them to error with the given object.
     * This should be used when terminating a session in order to violate all routes.
     * @param error
     */
     invalidateAllRoutes$(error: Error) {
        // The wait(0) thing is needed to prevent a bug in rxjs where it seems that
        // causing a source observable to error while in a flatMap will hang the observable
        return defer(() => {
            this._onClosed.complete();
            let routes = this._router.matchAll();
            for (let route of routes) {
                route.error(error);
            }
            return EMPTY;
        });
    }

    /**
     * Like {@link  expect$}, except that this defines several routes with a union.
     * @see expect$
     * @param routes
     */
    expectAny$<T>(...routes: WampPrimitive[][]) {
        return merge(...routes.map(rt => this.expect$(rt)));
    }

    private _setupRouter() {
        this.transport.events$.subscribe({
            next: x => {
                if (x.type === "error") {
                    this._defaultRoute.error(x.data);
                } else if (x.type === "message") {
                    if (!(Array.isArray(x.data))) {
                        throw new WampusNetworkError("Non-array message.", {});
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
            error:err => {
                let all = this._router.matchAll();
                if (all.length === 0) {
                    this._defaultRoute.error(err);
                } else {
                    all.forEach(route => route.error(err));
                }
            }
        });
    }
}