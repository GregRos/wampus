import {TransportMessage, Transport} from "./messaging/transport/transport";
import {
    WampMessage, WampObject, WampUriString
} from "./wamp/messages";
import {EventEmitter} from "events";
import {WampType} from "./wamp/message.type";
import * as most from "most";
import {defer$} from "../most-ext/most-ext";

export interface SessionConfig {
    realm: string;
    timeout: number;
    transport$: most.Stream<WebsocketTransport>
}

import WM = WampMessage;
import {Errs, IllegalOperations, NetworkErrors} from "../errors/errors";

import {MessageRouter} from "./messaging/routing/message-router";
import {WampUri} from "./wamp/uris";
import {MessageReader, MessageBuilder} from "./wamp/helper";
import {
    WampusError,
    WampusIllegalOperationError,
    WampusInvocationCanceledError,
    WampusInvocationError,
    WampusNetworkError
} from "../errors/types";
import {WebsocketTransport} from "./messaging/transport/websocket";
import {Routes} from "./messaging/routing/routing";
import {
    CancelMode,
    WampCallOptions,
    WampInvocationOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampSubscribeOptions
} from "./wamp/options";
import {WampMessenger} from "./messaging/wamp-messenger";
import {empty, Stream, Subscription} from "most";
import {wait$} from "../most-ext/most-ext";
import {InvocationRequest} from "./methods/invocation";
import {EventArgs} from "./methods/event";
import {CallResult} from "./methods/call";
import {WampResult} from "./methods/shared";
import {Subject} from "../most-ext/subject";

function processErrorDuringGoodbye(myGoodbye: WM.Goodbye, error: WM.Error) {
    return new WampusNetworkError("Error during goodbye.", {
        error
    });
}

function processErrorDuringSubscribe(subscribe: WM.Subscribe, error: WM.Error) {
    return new Error("Failed!");
}

let factory = new MessageBuilder(() => Math.floor(Math.random() * (2 << 50)));

export interface EventPublisher {
    publish$(options: WampPublishOptions, data: WampResult): Stream<any>;
}

export class InternalSession {
    id: number;
    _config: SessionConfig;
    readonly errors$ = Subject.create() as Subject<WampusError>;
    private _messenger: WampMessenger;

    static create$(config: SessionConfig): most.Stream<InternalSession> {
        return config.transport$.deriveDependentResource(transport => {
            let messenger = WampMessenger.create(transport);
            let session = new InternalSession();
            session._config = config;
            session._messenger = messenger;
            return session._handshake$().map(welcome => {
                session.id = welcome.sessionId;
                return session;
            }).continueWith(() => most.never()).lastly(async () => {
                await session._close$({}, WampUri.CloseReason.GoodbyeAndOut, false).drain();
            });
        });
    }

    register$(options: WampRegisterOptions, name: string): Stream<Stream<InvocationRequest>> {
        let msg = factory.register(options, name);
        let sending = this._messenger.send$(msg).flatMap(() => most.empty());

        return this._messenger.expectAny$(
            Routes.registered(msg.requestId),
            Routes.error(WampType.REGISTER, msg.requestId)
        ).merge(sending).map(x => {
            if (x instanceof WampMessage.Error) {
                switch (x.error) {
                    case WampUri.Error.ProcAlreadyExists:
                        throw Errs.Register.procedureAlreadyExists(msg.procedure);
                    default:
                        throw Errs.Register.error(msg.procedure, x);
                }
            }
            return x as WampMessage.Registered;
        }).take(1).map((registered) => {
            let unregisteredSent = this._messenger.expectAny$(Routes.unregistered(registered.registrationId));
            return this._messenger.expectAny$(Routes.invocation(registered.registrationId)).takeUntil(unregisteredSent).lastly(async () => {
                let unregisterMsg = (factory.unregister(registered.registrationId));
                let sending = this._messenger.send$(unregisterMsg);
                return this._messenger.expectAny$(Routes.unregistered(registered.registrationId), Routes.error(WampType.UNREGISTER, unregisterMsg.requestId))
                    .merge(sending)
                    .tap(x => {
                        if (x instanceof WampMessage.Error) {
                            switch (x.error) {
                                case WampUri.Error.NoSuchRegistration:
                                    throw Errs.Unregister.registrationDoesntExist(name, x);
                                default:
                                    throw Errs.Unregister.other(name, x);
                            }
                        }
                    })
                    .drain();
            }).map(x => x as WampMessage.Invocation).map(msg => {
                let args = new InvocationRequest(name, msg, {
                    factory,
                    send$: (msg) => {
                        return this._messenger.send$(msg);
                    },
                    expectInterrupt$: this._messenger.expectAny$([WampType.INTERRUPT, msg.requestId]).map(x => x as WM.Interrupt)
                });
                return args;
            });
        });
    }

    register(options : WampRegisterOptions, name : string, procedure : (req : InvocationRequest) => Promise<any> | any) : Promise<Subscription<any>> {
        return new Promise((resolve, reject) => {
            let sub : Subscription<any>;
            let isResolved = true;
            let parentSub = this.register$(options, name).subscribeSimple(stream => {
                sub = stream.subscribeSimple(req => {
                    req.handle(procedure).then(() => {}, () => {});
                });
                isResolved = true;
                resolve({
                    unsubscribe() {
                        sub.unsubscribe();
                        parentSub.unsubscribe();
                    }
                });
            }, (err) => {
                if (!isResolved) {
                    isResolved = true;
                    reject(err);
                }
            });
        });
    }

    publish(options : WampPublishOptions, name : string, data : WampResult) {
        return this.publish$(options, name, data).toPromise();
    }

    publish$(options: WampPublishOptions, name: string, data: WampResult): Stream<any> {
        return defer$(() => {
            let msg = factory.publish(options, name, data.args, data.kwargs);
            let expectAcknowledge$: Stream<any>;
            if (options.acknowledge) {
                expectAcknowledge$ = this._messenger.expectAny$(
                    Routes.published(msg.requestId),
                    Routes.error(WampType.PUBLISH, msg.requestId)
                ).flatMap(msg => {
                    if (msg instanceof WM.Error) {
                        throw new WampusIllegalOperationError("Failed to publish.", {
                            msg
                        });
                    }
                    return empty();
                });
            } else {
                expectAcknowledge$ = empty();
            }
            return this._messenger.send$(msg).merge(expectAcknowledge$);
        })

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
    event$(options: WampSubscribeOptions, name: string): Stream<Stream<EventArgs>> {
        return defer$(() => {
            let msg = factory.subscribe(options, name);
            let sending$ = this._messenger.send$(msg);
            return this._messenger.expectAny$(
                Routes.subscribed(msg.requestId),
                Routes.error(WampType.SUBSCRIBE, msg.requestId)
            ).merge(sending$).map(x => {
                if (x instanceof WM.Error) {
                    switch (x.error){
                        case WampUri.Error.NotAuthorized:
                            throw Errs.notAuthorized("Subscribe to {event}", {
                                event : name
                            });
                    }
                    throw processErrorDuringSubscribe(msg, x);
                }
                return x as WM.Subscribed;
            });
        }).map(subscribed => {
            let unsub = factory.unsubscribe(subscribed.subscriptionId);
            return this._messenger.expectAny$(Routes.event(subscribed.subscriptionId)).lastly(async () => {
                return this._messenger.expectAny$(
                    Routes.unsubscribed(subscribed.subscriptionId),
                    Routes.error(WampType.UNSUBSCRIBE, unsub.requestId)
                ).map(msg => {
                    if (msg instanceof WampMessage.Error) {
                        switch (msg.error) {
                            case WampUri.Error.NoSuchSubscription:
                                throw Errs.Unsubscribe.subDoesntExist(msg, name);
                            default:
                                throw Errs.Unsubscribe.other(msg, name);
                        }
                    }
                }).merge(this._messenger.send$(unsub)).take(1).drain()
            }).map((x: WM.Event) => {
                let a = new EventArgs(name, x);
                return a;
            });
        });
    }

    call$(options: WampCallOptions, name: string, args: any[], kwargs: any): Stream<CallResult> {
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

        return defer$(() => {
            let msg = factory.call(options, name, args, kwargs);
            let cancelCall = true;

            let expectReply$ = self._messenger.expectAny$(
                Routes.result(msg.requestId),
                Routes.error(WampType.CALL, msg.requestId)
            ).tap(() => {
                cancelCall = false;
            }) as Stream<WampMessage.Any>;
            let sending$ = this._messenger.send$(msg).concat(most.never().lastly(async () => {
                if (!cancelCall) return;
                await this._messenger.send$(factory.cancel(msg.requestId, {
                    mode: options.cancelMode || CancelMode.Kill
                })).merge(expectReply$).tap((msg: WampMessage.Any) => {
                    if (msg instanceof WampMessage.Error) {
                        if (msg.error === WampUri.Error.Canceled) {
                            return;
                        } else {
                            throw new WampusIllegalOperationError("While cancelling, received error.", {
                                msg
                            })
                        }
                    }
                    if (msg instanceof WampMessage.Result) {
                        console.log("Cancelling didn't seem to work. Received result instead.")
                    }
                }).take(1).drain();
            }));

            return expectReply$.map(x => {
                if (x instanceof WampMessage.Error) {
                    switch (x.error) {
                        case WampUri.Error.NoSuchProcedure:
                            throw Errs.Call.noSuchProcedure(msg.procedure);
                        case WampUri.Error.NoEligibleCallee:
                            throw Errs.Call.noEligibleCallee(msg.procedure);
                        case WampUri.Error.DisallowedDiscloseMe:
                            throw Errs.Call.optionDisallowedDiscloseMe(msg.procedure);
                        case WampUri.Error.OptionNotAllowed:
                            throw Errs.optionNotAllowed(msg, x);
                    }
                    if (x.error === WampUri.Error.RuntimeError || !x.error.startsWith(WampUri.Error.Prefix)) {
                        throw Errs.Call.errorResult(name, x);
                    }
                    else if (x.error.startsWith(WampUri.Error.Prefix)) {
                        throw Errs.Call.other(name, x);
                    }
                }
                if (x instanceof WampMessage.Result) {
                    return new CallResult(name, x);
                }
                throw new Error("Unknown message.");
            }).merge(sending$).skipAfter(cr => {
                return !cr.isProgress;
            });
        });
    }



    private _close$(details: WampObject, reason: WampUriString, abrupt: boolean): Stream<any> {
        if (abrupt) {
            return this._abort$(details, reason);
        }

        let timeout = defer$(() => {
            throw Errs.Leave.goodbyeTimedOut();
        }).delay(this._config.timeout);

        return this._goodbye$(details, reason).takeUntil(timeout).recoverWith(err => {
            console.warn("Error when saying GOODBYE. Going to say ABORT.", err);
            return this._abort$(details, reason);
        })
    }


    private _abort$(details: WampObject, reason: WampUriString) {
        return this._messenger.send$(factory.abort(details, reason))
            .concat(wait$(this._config.timeout))
            .recoverWith((err: Error) => {
                console.warn("Network error on ABORT.");
                return most.empty();
            });

    }

    private _goodbye$(details: WampObject, reason: WampUriString) {
        let myGoodbye = factory.goodbye(details, reason);
        let sending = this._messenger.send$(myGoodbye);
        return this._messenger.expectAny$(
            Routes.goodbye,
            Routes.error(WampType.GOODBYE)
        ).merge(sending).map(x => {
            if (x instanceof WampMessage.Error) {
                throw Errs.Leave.errorOnGoodbye(x);
            }
            return x as WampMessage.Goodbye;
        });
    }

    private _handshake$(): Stream<WM.Welcome> {
        let messenger = this._messenger;
        let config = this._config;
        let hello = factory.hello(config.realm, {
            roles: {
                callee: {},
                caller: {},
                publisher: {},
                subscriber: {}
            }
        });

        let welcomeMessage = messenger.expectNext$().map(msg => {
            if (msg instanceof WM.Abort) {
                switch (msg.reason) {
                    case WampUri.Error.NoSuchRealm:
                        throw Errs.Handshake.noSuchRealm(hello.realm);
                    case WampUri.Error.ProtoViolation:
                        throw Errs.receivedProtocolViolation(hello.type, null);
                    default:
                        throw Errs.Handshake.unrecognizedError(msg);
                }
            }
            if (msg instanceof WM.Challenge) {
                throw Errs.featureNotSupported(msg, "CHALLENGE authentication");
            }
            if (!(msg instanceof WM.Welcome)) {
                throw Errs.Handshake.unexpectedMessage(msg);
            }
            return msg as WM.Welcome;
        }).merge(messenger.send$(hello)).take(1);
        return welcomeMessage;
    }

    private _registerRoutes() {
        let serverAborted = this._messenger.expectAny$([WampType.ABORT]).take(1);
        let serverGoodbye = this._messenger.expectAny$([WampType.GOODBYE]).take(1);
        let serverSentInvalidMessage = this._messenger.expectAny$(
            [WampType.WELCOME],
            [WampType.CHALLENGE]
        );
        let serverSentRouterMessage = this._messenger.expectAny$(
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