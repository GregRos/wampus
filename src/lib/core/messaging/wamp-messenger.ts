import {WampArray, WampMessage, WampusRouteCompletion} from "../../protocol/messages";
import {WebsocketTransport} from "../transport/websocket";
import {WampusNetworkError} from "../../errors/types";
import {MessageRoute, MessageRouter} from "../routing/message-router";
import {Transport, TransportMessage} from "../transport/transport";
import {Errs} from "../../errors/errors";
import {MessageReader} from "../../protocol/reader";
import {merge, Observable, of, Subject} from "rxjs";
import {flatMap, take, tap} from "rxjs/operators";
import {MyPromise} from "../../ext-promise";

/**
 * This class provides a mid-level abstraction layer between the transport and the WAMP session object.
 * It's responsible for sending messages and using the message router to connect messages to their subscriptions.
 */
export class WampMessenger<T> {
    transport : Transport;
    private _onClosed = new Subject<object>();
    private _onUnknownMessage = new Subject<any>();
    public _router : MessageRouter<T>;
    private _selector : (x : WampArray) => T;
    /**
     * Use [[WampMessenger.create]].
     * @param {never} never
     */
    constructor(never : never) {

    }

    /**
     * Creates a COLD observable that will yield a WampMessenger when subscribed to. Closing the subscription will dispose of the messenger.
     * The messenger will be created with a transport, ready for messaging.
     * @returns {Observable<WampMessenger>}
     */
    static create<T>(transport : Transport, selector : (x : WampArray) => T) : WampMessenger<T> {
        let messenger = new WampMessenger<T>(null as never);
        messenger.transport = transport;
        messenger._selector = selector;
        let router = messenger._router = new MessageRouter<T>();
        messenger._setupRouter();
        return messenger;
    }

    private _defaultRoute : MessageRoute<any> = {
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
        this.transport.events.subscribe({
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
     * Creates a COLD observable that will send a WAMP message to the router via the transport, once subscribed to. Unsubscribing will do nothing.
     * The observable will complete once the message has been sent.
     * @param {WampMessage.Any} msg The message to send.
     * @returns {Observable<never>} A stream that completes once the sending finishes.
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
     * Creates an observable that will yield the next transoirt event.
     * Will error if the next transport event is an error, if the WAMP session is closed, or the transport is closed.
     * @returns {Observable<WampMessage.Any>}
     */
    expectNext$() {
        return merge(this.expect$([]), this.onClosed.pipe(tap(x => {
            //TODO: Better handling of abrupt disconnect by server
            throw new WampusNetworkError("Connection abruptly closed.");
        }))).pipe(take(1))
    }

    /**
     * Creates a COLD observable that, when subscribed to, will wait for the next message receives by this messenger that matches the given route.
     * The route will be active until the subscription is closed, at which point it will be cleared.
     * @param {WampArray} route
     * @returns {Observable<WampMessage.Any>}
     */
    expect$(route : WampArray) : Observable<T> {
        return Observable.create(sub => {
            let inv = {
                keys : route,
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

    invalidateAllRoutes(msg : Error) {
        // The timer(0) thing is needed to prevent a bug in rxjs where it seems that
        // causing a source observable to error while in a flatMap will hang the observable
        // TODO: Report bug
        MyPromise.wait(0).then(() => {
            this._onClosed.complete();
            let routes = this._router.matchAll();
            for (let route of routes){
                route.error(msg);
            }
        });

    }

    expectAny$<T>(...routes : WampArray[]) {
        return merge(...routes.map(rt => this.expect$(rt)));
    }
}