import {TransportMessage, Transport} from "./messaging/transport/transport";
import {
    WampMessage, WampObject, WampUriString
} from "./wamp/messages";
import {EventEmitter} from "events";
import {WampType} from "./wamp/message.type";
import most = require("most");
import "../most-ext/events";

export interface SessionConfig {
    realm: string;
    timeout: number;
    transport: most.Stream<WebsocketTransport>
}

import WM = WampMessage;
import {Errs, IllegalOperations, NetworkErrors} from "../errors/errors";

import {MessageRouter} from "./messaging/routing/message-router";
import {WampUri} from "./wamp/uris";
import {MessageReader, MessageBuilder} from "./wamp/helper";
import {WampusIllegalOperationError, WampusInvocationError, WampusNetworkError} from "../errors/types";
import {DisposableToken, EventArgs, InvocationArgs} from "./call";
import {WebsocketTransport} from "./messaging/transport/websocket";
import {Routes} from "./messaging/routing/routing";
import {
    WampCallOptions,
    WampInvocationOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampSubscribeOptions
} from "./wamp/options";
import {WampMessenger} from "./messaging/wamp-messenger";
import {Stream} from "most";

function processAbortDuringHandshake(hello: WM.Hello, msg: WM.Abort) {
    switch (msg.reason) {
        case WampUri.Error.NoSuchRealm:
            return Errs.Handshake.noSuchRealm(hello.realm);
        case WampUri.Error.ProtoViolation:
            return Errs.receivedProtocolViolation(hello.type, null);
        default:
            return Errs.Handshake.unrecognizedError(msg);
    }
}

function processErrorDuringGoodbye(myGoodbye : WM.Goodbye, error : WM.Error) {
    return new WampusNetworkError("Error during goodbye.", {
        error
    });
}

function processErrorDuringCall(call: WM.Call, msg: WM.Error) {
    switch (msg.error) {
        case WampUri.Error.NoSuchProcedure:
            return Errs.Call.noSuchProcedure(call.procedure);
        case WampUri.Error.NoEligibleCallee:
            return Errs.Call.noEligibleCallee(call.procedure);
        case WampUri.Error.DisallowedDiscloseMe:
            return Errs.Call.optionDisallowedDiscloseMe(call.procedure);
        default:
            return new Error("Implement this case");
    }
}

function processErrorDuringRegister(register: WM.Register, msg: WM.Error) {
    switch (msg.error) {
        case WampUri.Error.ProcAlreadyExists:
            return Errs.Register.procedureAlreadyExists(register.procedure);
        default:
            return Errs.Register.error(register.procedure, msg);

    }
}

function processErrorDuringSubscribe(subscribe: WM.Subscribe, error: WM.Error) {
    return new Error("Failed!");
}

let factory = new MessageBuilder(() => Math.floor(Math.random() * (2 << 50)));

export class InternalSession {
    id: number;
    _config: SessionConfig;
    private _messenger : WampMessenger;

    static create(config: SessionConfig) : most.Stream<InternalSession> {
        return WampMessenger.create(config).flatMapPromise( messenger => {
            let session = new InternalSession();
            session._config = config;
            session._messenger = messenger;
            return session._handshake().map(welcome => {
                session.id = welcome.sessionId;
                return session;
            })
        })

    }

    register(options: WampRegisterOptions, name: string, handler: (args: InvocationArgs) => Promise<any> | any): Promise<DisposableToken> {
        let msg = factory.register(options, name);
        let sending = this._messenger.send(msg).flatMap(() => most.empty());

        return new Promise<DisposableToken>((resolve, reject) => {
            this._messenger.expectAny(
                Routes.registered(msg.requestId),
                Routes.error(WampType.REGISTER, msg.requestId)
            ).merge(sending).map(x => {
                if (x instanceof WampMessage.Error) {
                    throw processErrorDuringRegister(msg, x);
                }
                return x as WampMessage.Registered;
            }).tap(registered => {
                resolve({
                    dispose: () => {
                        let sending = this._messenger.send(factory.unregister(registered.registrationId));
                        return this._messenger.expectAny(Routes.unregistered(registered.registrationId))
                            .merge(sending)
                            .drain();
                    }
                });
            }).recoverWith((err : any) => {
                reject(err);
                return most.throwError(err);
            }).flatMap(registered => {
                let unregisteredSent = this._messenger.expectAny(Routes.unregistered(registered.registrationId));
                return this._messenger.expectAny(Routes.invocation(registered.registrationId)).takeUntil(unregisteredSent);
            }).map(x => x as WampMessage.Invocation).flatMapPromise(async msg => {
                    let args = new InvocationArgs(msg, {
                        factory,
                        send : msg => this._messenger.send(msg)
                    });
                    try {
                        let r = await handler(args);
                        if (!args.isHandled) {
                            await args.return([], r);
                        }
                    }
                    catch (err) {
                        if (!args.isHandled) {
                            await args.error([], err);
                        } else {
                            throw err;
                        }
                    }
                }).drain();
        })
    }

    publisher(options: WampPublishOptions, name: string) : (args : any[], kwargs : any) => Promise<void> {
        return async (args, kwargs) => {
            let publish = factory.publish(options, name, args, kwargs);
            let sending = this._messenger.send(publish);
            return most.just(null).flatMap(() => {
                if (options.acknowledge) {
                    return this._messenger.expectAny(
                        Routes.published(publish.requestId),
                        Routes.error(WampType.PUBLISH, publish.requestId)
                    ).map(msg => {
                        if (msg instanceof WM.Error) {
                            throw new WampusIllegalOperationError("Failed to publish.", {
                                msg
                            });
                        }
                        return msg as WM.Published;
                    }).take(1);
                }
                return most.empty();
            }).merge(sending).drain()
        }
    }

    /**
     * Returns a cold stream to a hot data source.
     * Sends a subscription message. The returned observable fires when the subscription is created,
     * yielding a hot observable containing the events as they are fired.
     * Unsubscribing from the outer cold observable terminates the subscription.
     * If you don't care when the subscription actually happens, just use .switchLatest() to get a flat event stream.
     * @param {WampSubscribeOptions} options
     * @param {string} name
     * @returns {Stream<Stream<EventArgs>>}
     */
    event(options: WampSubscribeOptions, name: string) : most.Stream<most.Stream<EventArgs>>    {
        return most.just(null).flatMap(() => {
            let msg = factory.subscribe(options, name);
            let sending = this._messenger.send(msg).flatMap(() => most.empty());
            return this._messenger.expectAny(
                Routes.subscribed(msg.requestId),
                Routes.error(WampType.SUBSCRIBE, msg.requestId)
            ).merge(sending).map(x => {
                if (x instanceof WM.Error) {
                    throw processErrorDuringSubscribe(msg, x);
                }
                return x as WM.Subscribed;
            });
        }).map(subscribed => {
            return this._messenger.expectAny(Routes.event(subscribed.subscriptionId)).lastly(async () => {
                return this._messenger.expectAny(Routes.unsubscribed(subscribed.subscriptionId))
                    .merge(this._messenger.send(factory.unsubscribe(subscribed.subscriptionId)))
                    .drain()
            }).map((x: WM.Event) => {
                let a = new EventArgs(x);
                return a;
            });
        });
    }

    call(options: WampCallOptions, name: string, args: any[], kwargs: any) {
        let self = this;
        /*
        TODO: Implement advanced features
        1. Cancellation
        2. Caller disclosure
        3. Filtering
        4. Progress reports
        5. Timeout
        6. Sharded registration (N/A)
         */

        return most.just(null).flatMap(() => {
            let msg = factory.call(options, name, args, kwargs);
            let sending = this._messenger.send(msg).flatMap(x => most.empty());
            return self._messenger.expectAny(
                Routes.result(msg.requestId),
                Routes.error(WampType.CALL, msg.requestId)
            ).map(x => {
                if (x instanceof WampMessage.Error) {
                    throw processErrorDuringCall(msg, x);
                }
                return x as WampMessage.Result;
            }).take(1).merge(sending);
        });
    }

    close(reason ?: WampUriString, details ?: WampObject, abrupt ?: boolean) {
        return this._goodbye(details, reason).recoverWith(() => this.close(reason, details, true));
    }

    private _abort(details : WampObject, reason : WampUriString) {
        return this._messenger.send(factory.abort(details,reason));
    }

    private _goodbye(details : WampObject, reason : WampUriString) {
        let myGoodbye = factory.goodbye(details, reason);
        let sending = this._messenger.send(myGoodbye);
        return this._messenger.expectAny(
            Routes.goodbye,
            Routes.error(WampType.GOODBYE)
        ).merge(sending).map(x => {
            if (x instanceof WampMessage.Error) {
                throw processErrorDuringGoodbye(myGoodbye, x);
            }
            return x as WampMessage.Goodbye;
        });
    }

    private  _handshake() : Stream<WM.Welcome> {
        let messenger = this._messenger;
        let config = this._config;
        let hello = factory.hello(config.realm, {
            roles: {
                callee: {},
                caller: {},
                publisher : {},
                subscriber : {}
            }
        });

        let welcomeMessage = messenger.expectNext().map(msg => {
            if (msg instanceof WM.Abort) {
                throw processAbortDuringHandshake(hello, msg);
            }
            if (msg instanceof WM.Challenge) {
                throw Errs.featureNotSupported(msg, "CHALLENGE authentication");
            }
            if (!(msg instanceof WM.Welcome)) {
                throw Errs.Handshake.unexpectedMessage(msg);
            }
            return msg as WM.Welcome;
        }).merge(messenger.send(hello)).take(1);
        return welcomeMessage;
    }

    private _registerRoutes() {
        let serverAborted = this._messenger.expectAny([WampType.ABORT]).take(1);
        let serverGoodbye = this._messenger.expectAny([WampType.GOODBYE]).take(1);
        let serverSentInvalidMessage = this._messenger.expectAny(
            [WampType.WELCOME],
            [WampType.CHALLENGE]
        );
        let serverSentRouterMessage = this._messenger.expectAny(
            [WampType.AUTHENTICATE],
            [WampType.YIELD],
            [WampType.HELLO],
            [WampType.REGISTER],
            [WampType.CALL],
            [WampType.PUBLISH],
            [WampType.UNREGISTER],
            [WampType.SUBSCRIBE],
            [WampType.UNSUBSCRIBE],
            [WampType.CANCEL]
        );
    }


}