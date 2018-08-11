import {TransportMessage, Transport} from "./messaging/transport/transport";
import {
    WampMessage, WampObject, WampUriString
} from "./wamp/messages";
import {EventEmitter} from "events";
import {WampType} from "./wamp/message.type";

export interface SessionConfig {
    realm: string;
    timeout: number;
    transport$: Observable<WebsocketTransport>
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
import {InvocationRequest} from "./methods/invocation";
import {EventArgs} from "./methods/event";
import {CallResult} from "./methods/call";
import {WampResult} from "./methods/shared";
import {
    concat,
    NEVER,
    Observable,
    Subject,
    empty,
    EMPTY,
    merge,
    Subscription,
    defer,
    timer,
    throwError,
    of
} from "rxjs";
import {
    map,
    finalize,
    flatMap,
    takeUntil,
    take,
    mapTo,
    mergeMapTo,
    tap,
    delay,
    timeoutWith,
    catchError, switchMap, startWith, takeWhile,
} from "rxjs/operators";
import {SubscriptionLike} from "rxjs/src/internal/types";

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
    publish$(options: WampPublishOptions, data: WampResult): Observable<any>;
}

export class InternalSession {
    id: number;
    _config: SessionConfig;
    readonly errors$ = Subject.create() as Subject<WampusError>;
    private _messenger: WampMessenger;

    static create$(config: SessionConfig): Observable<InternalSession> {
        // 1. Receive transport
        // 2. Handshake
        // 3. Wait until session closed:
        //      On close: Initiate goodbye sequence.
        return config.transport$.pipe(flatMap(transport => {
            let messenger = WampMessenger.create(transport);
            let session = new InternalSession();
            session._config = config;
            session._messenger = messenger;
            let getSessionFromShake$ = session._handshake$().pipe(map(welcome => {
                session.id = welcome.sessionId;
            }));
            let sessionLiveUntilClose$ = NEVER.pipe(finalize(async () => {
                await session._close$({}, WampUri.CloseReason.GoodbyeAndOut, false).toPromise();
            }));

            return concat(getSessionFromShake$, sessionLiveUntilClose$).pipe(mapTo(session));
        }));
    }

    register$(options: WampRegisterOptions, name: string): Observable<Observable<InvocationRequest>> {
        let msg = factory.register(options, name);
        let sending$ = this._messenger.send$(msg).pipe(mergeMapTo(EMPTY));

        let expectRegisteredOrError$ = this._messenger.expectAny$(
            Routes.registered(msg.requestId),
            Routes.error(WampType.REGISTER, msg.requestId)
        );

        let failOnError = map((x: WampMessage) => {
            if (x instanceof WampMessage.Error) {
                switch (x.error) {
                    case WampUri.Error.ProcAlreadyExists:
                        throw Errs.Register.procedureAlreadyExists(msg.procedure);
                    default:
                        throw Errs.Register.error(msg.procedure, x);
                }
            }
            return x as WampMessage.Registered;
        });

        let whenRegisteredReceived = map((registered: WM.Registered) => {
            let expectInvocation$ = this._messenger.expectAny$(Routes.invocation(registered.registrationId));
            let whenRegistrationClosedFinalize = finalize(async () => {
                let unregisterMsg = factory.unregister(registered.registrationId);
                let sendingUnregister$ = this._messenger.send$(unregisterMsg);
                let receivedUnregistered$ = this._messenger.expectAny$(Routes.unregistered(registered.registrationId), Routes.error(WampType.UNREGISTER, unregisterMsg.requestId));
                let failOnUnregisterError = map((x: WM.Any) => {
                    if (x instanceof WampMessage.Error) {
                        switch (x.error) {
                            case WampUri.Error.NoSuchRegistration:
                                throw Errs.Unregister.registrationDoesntExist(name, x);
                            default:
                                throw Errs.Unregister.other(name, x);
                        }
                    }
                    return x as WM.Unregistered;
                });


                return merge(sendingUnregister$, receivedUnregistered$).pipe(failOnUnregisterError, take(1)).toPromise();
            });
            let whenInvocationReceived = map((msg: WM.Invocation) => {
                let expectInterrupt$ = this._messenger.expectAny$([WampType.INTERRUPT, msg.requestId]).pipe(map(x => x as WM.Interrupt));
                let args = new InvocationRequest(name, msg, {
                    factory,
                    send$: (msg) => {
                        return this._messenger.send$(msg);
                    },
                    expectInterrupt$: expectInterrupt$
                });
                return args;
            });
            return expectInvocation$.pipe(whenRegistrationClosedFinalize, whenInvocationReceived);
        });

        let result = merge(sending$, expectRegisteredOrError$).pipe(failOnError, take(1)).pipe(whenRegisteredReceived);
        return result;
    }

    register(options: WampRegisterOptions, name: string, procedure: (req: InvocationRequest) => Promise<any> | any): Promise<SubscriptionLike> {
        return new Promise((resolve, reject) => {
            let isResolved = true;
            let parentSub = this.register$(options, name).subscribe(innerRx => {
                let sub = innerRx.subscribe(invocation => {
                    invocation.handle(procedure).then(() => {
                    }, () => {
                    });
                });
                isResolved = true;
                resolve({
                    unsubscribe() {
                        sub.unsubscribe();
                        parentSub.unsubscribe();
                    },
                    get closed() {
                        return parentSub.closed;
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

    publish(options: WampPublishOptions, name: string, data: WampResult) {
        return this.publish$(options, name, data).toPromise();
    }

    publish$(options: WampPublishOptions, name: string, data: WampResult): Observable<void> {
        return defer(() => {
            let msg = factory.publish(options, name, data.args, data.kwargs);
            let expectAcknowledge$: Observable<any>;
            if (options.acknowledge) {
                let expectPublishedOrError$ = this._messenger.expectAny$(
                    Routes.published(msg.requestId),
                    Routes.error(WampType.PUBLISH, msg.requestId)
                );
                let failOnError = map((msg: WM.Any) => {
                        if (msg instanceof WM.Error) {
                            throw new WampusIllegalOperationError("Failed to publish.", {
                                msg
                            });
                        }
                        return msg;
                    }
                );
                expectAcknowledge$ = expectPublishedOrError$.pipe(failOnError, mergeMapTo(EMPTY));
            } else {
                expectAcknowledge$ = EMPTY;
            }
            let sendingPublish = this._messenger.send$(msg);
            return merge(sendingPublish, expectAcknowledge$);
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
    event$(options: WampSubscribeOptions, name: string): Observable<Observable<EventArgs>> {
        let expectSubscribedOrError = defer(() => {
            let msg = factory.subscribe(options, name);
            let sending$ = this._messenger.send$(msg);
            let expectSubscribedOrError$ = this._messenger.expectAny$(
                Routes.subscribed(msg.requestId),
                Routes.error(WampType.SUBSCRIBE, msg.requestId)
            );
            let failOnErrorOrCastToSubscribed = map((x : WM.Any) => {
                if (x instanceof WM.Error) {
                    switch (x.error) {
                        case WampUri.Error.NotAuthorized:
                            throw Errs.notAuthorized("Subscribe to {event}", {
                                event: name
                            });
                    }
                    throw processErrorDuringSubscribe(msg, x);
                }
                return x as WM.Subscribed;
            });
            return merge(sending$, expectSubscribedOrError$).pipe(failOnErrorOrCastToSubscribed);
        });

        let whenSubscribedStreamEvents = map((subscribed : WM.Subscribed) => {
            let unsub = factory.unsubscribe(subscribed.subscriptionId);
            let expectEvents$ = this._messenger.expectAny$(Routes.event(subscribed.subscriptionId));
            let finalizeOnClose = finalize(async () => {
                let expectUnsubscribedOrError$ = this._messenger.expectAny$(
                    Routes.unsubscribed(subscribed.subscriptionId),
                    Routes.error(WampType.UNSUBSCRIBE, unsub.requestId)
                );

                let failOnUnsubscribedError = map((msg : WM.Any) => {
                    if (msg instanceof WampMessage.Error) {
                        switch (msg.error) {
                            case WampUri.Error.NoSuchSubscription:
                                throw Errs.Unsubscribe.subDoesntExist(msg, name);
                            default:
                                throw Errs.Unsubscribe.other(msg, name);
                        }
                    }
                    return msg as WM.Unsubscribed;
                });

                let sendUnsub$ = this._messenger.send$(unsub);

                let total = merge(sendUnsub$, expectUnsubscribedOrError$).pipe(failOnUnsubscribedError, take(1));
                return total.toPromise();
            });

            let mapToLibraryEvent = map((x : WM.Event) => {
                let a = new EventArgs(name, x);
                return a;
            });
            return expectEvents$.pipe(finalizeOnClose, mapToLibraryEvent);
        });

        return expectSubscribedOrError.pipe(take(1), whenSubscribedStreamEvents)
    }

    call$(options: WampCallOptions, name: string, args: any[], kwargs: any): Observable<CallResult> {
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

        return defer(() => {
            let msg = factory.call(options, name, args, kwargs);
            let isRunning = true;


            let unmarkRunningIfResultReceived = tap((x : WM.Any) => {
                if (x instanceof WM.Error) isRunning = false;
                if (x instanceof WM.Result) {
                    if (!x.details.progress) {
                        isRunning = false;
                    }
                }
            });
            let expectResultOrError$ = self._messenger.expectAny$(
                Routes.result(msg.requestId),
                Routes.error(WampType.CALL, msg.requestId)
            );

            let finalizeOnCancel = finalize(async () => {
                // If a result is already received, do not try to cancel the call.
                if (!isRunning) return;

                let cancel = factory.cancel(msg.requestId, {
                    mode: options.cancelMode || CancelMode.Kill
                });
                let sendCancel$ = this._messenger.send$(cancel);

                let handleOnCancelResponse = tap((msg : WM.Any) => {
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
                });

                return merge(sendCancel$, expectResultOrError$).pipe(handleOnCancelResponse, take(1)).toPromise();
            });

            let cancellableStage$ = NEVER.pipe(finalizeOnCancel);


            let failOnError = map((x : WM.Any) => {
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
                    throw Errs.Call.other(name, x);
                }
                return x as WM.Result;
            });

            let toLibraryResult = map((x : WM.Any) => {
                if (x instanceof WampMessage.Result) {
                    return new CallResult(name, x);
                }
                throw new Error("Unknown message.");
            }) ;

            let sending$ = this._messenger.send$(msg);

            let exp = merge(concat(sending$, cancellableStage$), expectResultOrError$.pipe(unmarkRunningIfResultReceived)).pipe(failOnError).pipe(toLibraryResult) as Observable<CallResult>;
            let exp2 = exp.pipe(switchMap((msg : WM.Result) => {
                if (msg.details.progress) {
                    return of(msg);
                } else {
                    return of(msg, null)
                }
            })).pipe(takeWhile(m => !!m)) as Observable<CallResult>;
            return exp2;
        });
    }


    private _close$(details: WampObject, reason: WampUriString, abrupt: boolean): Observable<any> {
        if (abrupt) {
            return this._abort$(details, reason);
        }

        let timeout = timer(this._config.timeout).pipe(flatMap(() => {
            throw Errs.Leave.goodbyeTimedOut();
        }));

        let expectGoodbyeOrTimeout = merge(this._goodbye$(details, reason), timeout).pipe(catchError(err => {
            console.warn("Error when saying GOODBYE. Going to say ABORT.", err);
            return this._abort$(details, reason);
        }));

        return expectGoodbyeOrTimeout;
    }


    private _abort$(details: WampObject, reason: WampUriString) {
        let errorOnTimeout = timeoutWith(this._config.timeout, throwError(Errs.Leave.networkErrorOnAbort(new Error("Timed Out"))));
        let sending$ = this._messenger.send$(factory.abort(details, reason))
        return sending$.pipe(errorOnTimeout, catchError(() => {
            console.warn("Network error on ABORT.");
            return EMPTY;
        }));
    }

    private _goodbye$(details: WampObject, reason: WampUriString) {
        let myGoodbye = factory.goodbye(details, reason);
        let sending$ = this._messenger.send$(myGoodbye);
        let expectingByeOrError$ = this._messenger.expectAny$(
            Routes.goodbye,
            Routes.error(WampType.GOODBYE)
        );

        let failOnError = map((x : WM.Any) => {
            if (x instanceof WampMessage.Error) {
                throw Errs.Leave.errorOnGoodbye(x);
            }
            return x as WampMessage.Goodbye;
        });

        return merge(sending$, expectingByeOrError$).pipe(failOnError);
    }

    private _handshake$(): Observable<WM.Welcome> {
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

        let handleMessage = map((msg : WM.Any) => {
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
        });

        let sendHello$ = messenger.send$(hello);

        let welcomeMessage$ = merge(sendHello$, messenger.expectNext$()).pipe(handleMessage, take(1))
        return welcomeMessage$;
    }

    private _registerRoutes() {
        let serverAborted = this._messenger.expectAny$([WampType.ABORT]).pipe(take(1));
        let serverGoodbye = this._messenger.expectAny$([WampType.GOODBYE]).pipe(take(1));
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