import {WampArray, WampMessage, WampusRouteCompletion} from "../../protocol/messages";
import {WebsocketTransport} from "./transport/websocket";
import {WampusNetworkError} from "../../errors/types";
import {MessageRouter} from "./routing/message-router";
import {TransportMessage} from "./transport/transport";
import {Errs} from "../../errors/errors";
import {MessageReader} from "../../protocol/helper";
import {merge, Observable, of} from "rxjs";
import {flatMap, take} from "rxjs/operators";

/**
 * This class provides a mid-level abstraction layer between the transport and the WAMP session object.
 * It's responsible for sending messages and using the message router to connect messages to their subscriptions.
 */
export class WampMessenger {
    transport : WebsocketTransport;
    private _router : MessageRouter<WampMessage.Any>;

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
    static create(transport : WebsocketTransport) : WampMessenger {
        let messenger = new WampMessenger(null as never);
        messenger.transport = transport;
        let router = messenger._router = new MessageRouter<WampMessage.Any>();
        messenger._setupRouter();
        return messenger;
    }

    private _setupRouter() {
        this.transport.events.subscribe({
            next: x => {
                if (x.type === "error") {
                    let dflt = this._router.matchDefault()
                    dflt.forEach(route => route.error(x.data));
                } else if (x.type === "message") {
                    let msg = MessageReader.read(x.data);
                    this._router.match(x.data).forEach(route => route.next(msg));
                } else if (x.type === "closed") {
                    this._router.matchAll().forEach(route => {
                        route.error(new WampusNetworkError("The connection abruptly closed.", {
                            reason : x.data
                        }));
                    })
                }
            },
            complete: () => {

            },
            error: (err) => {
                this._router.matchDefault().forEach(route => {
                    route.error(err);
                })
            }
        });

        this._router.insertRoute({
            keys : [],
            error(err) {
                // error catch-all
                console.error(err);
            }
        })
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
        return this.expect$([]).pipe(take(1))
    }

    /**
     * Creates a COLD observable that, when subscribed to, will wait for the next message receives by this messenger that matches the given route.
     * The route will be active until the subscription is closed, at which point it will be cleared.
     * @param {WampArray} route
     * @returns {Observable<WampMessage.Any>}
     */
    expect$(route : WampArray) : Observable<WampMessage.Any> {
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
        let routes = this._router.matchAll();
        for (let route of routes){
            route.error(msg);
        }
    }

    expectAny$<T>(...routes : WampArray[]) {
        return merge(...routes.map(rt => this.expect$(rt)));
    }
}