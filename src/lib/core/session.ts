import {
    WampMessage,
    WampObject,
    WampUriString,
    WampusCompletionReason,
    WampusRouteCompletion
} from "../protocol/messages";
import {WampType} from "../protocol/message.type";
import {Errs} from "../errors/errors";
import {AdvProfile, WampUri} from "../protocol/uris";
import {MessageBuilder} from "../protocol/helper";
import {
    WampusError,
    WampusIllegalOperationError,
    WampusInvocationCanceledError,
    WampusNetworkError
} from "../errors/types";
import {WebsocketTransport} from "./messaging/transport/websocket";
import {Routes} from "./messaging/routing/route-helpers";
import {
    CancelMode,
    InvocationPolicy,
    WampPublishOptions,
    WampSubscribeOptions,
    WelcomeDetails
} from "../protocol/options";
import {WampMessenger} from "./messaging/wamp-messenger";
import {AbstractInvocationRequest} from "./methods/methods";
import {AbstractEventArgs} from "./methods/methods";
import {AbstractCallResult} from "./methods/methods";
import {WampResult} from "./methods/methods";
import {
    concat,
    defer,
    EMPTY,
    merge,
    NEVER,
    Observable,
    of,
    Operator,
    OperatorFunction,
    Subject,
    throwError,
    timer
} from "rxjs";
import {
    catchError,
    finalize,
    first,
    flatMap,
    map,
    mapTo,
    mergeMapTo,
    switchMap,
    take, takeUntil,
    takeWhile,
    tap,
    timeoutWith,
} from "rxjs/operators";
import {SubscriptionLike} from "rxjs/src/internal/types";
import {
    WampusCallArguments,
    WampusPublishArguments,
    WampusRegisterArguments, WampusSendErrorArguments, WampusSendResultArguments,
    WampusSubcribeArguments
} from "./api-parameters";
import {MyPromise} from "../ext-promise";

export interface SessionConfig {
    realm: string;
    timeout: number;
}

import WM = WampMessage;
import {fromPromise} from "rxjs/internal-compatibility";

let factory = new MessageBuilder(() => Math.floor(Math.random() * (2 << 50)));

export class Session {
    id: number;
    config: SessionConfig;
    readonly errors$ = Subject.create() as Subject<WampusError>;
    private _welcomeDetails: WelcomeDetails;
    private _messenger: WampMessenger;
    private _disconnecting = Subject.create();
    private _isClosing = false;

    get realm() {
        return this.config.realm;
    }

    get isActive() {
        return !this._isClosing;
    }


    static create(config: SessionConfig, transport: Promise<WebsocketTransport>): Promise<Session> {
        // 1. Receive transport
        // 2. Handshake
        // 3. Wait until session closed:
        //      On close: Initiate goodbye sequence.
        let rx = fromPromise(transport).pipe(flatMap(transport => {
            let messenger = WampMessenger.create(transport);
            let session = new Session();
            session.config = config;
            session._messenger = messenger;

            let getSessionFromShake$ = session._handshake$().pipe(map(welcome => {
                session.id = welcome.sessionId;
                session._welcomeDetails = welcome.details;
            }));

            return concat(getSessionFromShake$).pipe(mapTo(session));
        }));

        return rx.toPromise();
    }

    register$({options, procedure}: WampusRegisterArguments): Observable<Observable<AbstractInvocationRequest>> {
        /*
            Returns a cold observable yielding a hot observable.
            When the cold outer observable is subscribed to, Wampus will register the specified operation.
            The returned observable will yield the inner observable, which exposes invocations of the procedure,
            once the registration has finished.

            The inner observable will yield InvocationRequest objects each time the procedure is called. The InvocationRequest
            object allows the callee to handle a call of the procedure in various ways.

            1. Make sure the router's WELCOME message supports all the features specified in options and throw an error otherwise.

            2. Concurrently:
                * Expect on a REGISTERED or ERROR

                * Send a REGISTER message


         */

        options = options || {};
        let msg = factory.register(options, procedure);

        let {_welcomeDetails} = this;
        let features = _welcomeDetails.roles.dealer.features;
        // Make sure the router's WELCOME message supports all the features specified in options and throw an error otherwise.
        if (options.disclose_caller && !features.caller_identification) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallerIdentification));
        }
        if (options.match && !features.pattern_based_registration) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Call.PatternRegistration));
        }
        if (options.invoke && options.invoke !== InvocationPolicy.Single && !features.shared_registration) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Call.SharedRegistration));
        }
        let sending$ = this._messenger.send$(msg).pipe(mergeMapTo(EMPTY));

        // Expect a [REGISTERED] or [ERROR, REGISTER] message
        let expectRegisteredOrError$ = this._messenger.expectAny$(
            Routes.registered(msg.requestId),
            Routes.error(WampType.REGISTER, msg.requestId)
        );

        // Operator - in case of an ERROR message, throw an exception.
        let failOnError = map((x: WampMessage) => {
            if (x instanceof WampMessage.Error) {
                this._throwCommonError(msg, x);
                switch (x.error) {
                    case WampUri.Error.ProcAlreadyExists:
                        throw Errs.Register.procedureAlreadyExists(msg.procedure);
                    default:
                        throw Errs.Register.error(msg.procedure, x);
                }
            }
            return x as WampMessage.Registered;
        });

        // Operator - When Registered message is received, start listening for invocations.
        let whenRegisteredReceived = flatMap((registered: WM.Registered) => {
            // Expect INVOCATION message
            let expectInvocation$ = this._messenger.expectAny$(Routes.invocation(registered.registrationId)).pipe(catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    return EMPTY;
                }
                throw err;
            }));
            // Finalize by closing the REGISTRATION when the outer observable is abandoned.
            let whenRegistrationClosedFinalize = this._finalizeInUnsubscribe$<any>(async () => {
                if (this._isClosing) return;
                let unregisterMsg = factory.unregister(registered.registrationId);
                let sendingUnregister$ = this._messenger.send$(unregisterMsg);

                // Wait for a UNREGISTERED or ERROR;UNREGISTER message.
                let receivedUnregistered$ = this._messenger.expectAny$(Routes.unregistered(registered.registrationId), Routes.error(WampType.UNREGISTER, unregisterMsg.requestId));
                let failOnUnregisterError = map((x: WM.Any) => {
                    if (x instanceof WampMessage.Error) {
                        this._throwCommonError(unregisterMsg, x);
                        switch (x.error) {
                            case WampUri.Error.NoSuchRegistration:
                                throw Errs.Unregister.registrationDoesntExist(procedure, x);
                            default:
                                throw Errs.Unregister.other(procedure, x);
                        }
                    }
                    return x as WM.Unregistered;
                });

                // Send UNREGISTER and listen for messages at the same time
                return merge(sendingUnregister$, receivedUnregistered$).pipe(failOnUnregisterError, take(1), catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    return err;
                })).toPromise();
            });

            // Operator - Received INVOCATION message.
            let whenInvocationReceived = map((msg: WM.Invocation) => {
                // Expect INTERRUPT message for cancellation
                let expectInterrupt$ = this._messenger.expectAny$([WampType.INTERRUPT, msg.requestId]).pipe(map(x => x as WM.Interrupt));
                let isHandled = false;

                // Send message
                let send$ = (msg: WampMessage.Any) => {
                    if (msg instanceof WampMessage.Error || msg instanceof WampMessage.Yield && !msg.options.progress) {
                        if (isHandled) {
                            return throwError(Errs.Register.cannotSendResultTwice(procedure));
                        } else {
                            isHandled = true;
                        }
                    }
                    return this._messenger.send$(msg);
                };
                let req: AbstractInvocationRequest = {
                    error$({args, reason, kwargs, options}: WampusSendErrorArguments) {
                        return send$(this._commands.factory.error(WampType.INVOCATION, this.msg.requestId, options, reason, args, kwargs));
                    },
                    return$({args, kwargs, options}: WampusSendResultArguments) {
                        return send$(this._commands.factory.yield(this.msg.requestId, options, args, kwargs));
                    },
                    waitCancel$(time = 0) {
                        let waitForTime = takeUntil(timer(time));
                        let throwCancel$ = throwError(Errs.Invocation.cancelled())
                        let handleInterrupt = flatMap((x: WampMessage.Any) => {
                            return concat(this.error$({
                                reason: WampUri.Error.Canceled
                            }), throwCancel$);
                        });

                        return expectInterrupt$.pipe(waitForTime).pipe(handleInterrupt);
                    },
                    args: msg.args,
                    kwargs: msg.kwargs,
                    options: msg.options,
                    name: procedure
                };
                return req;
            });
            return concat(of(expectInvocation$.pipe(whenInvocationReceived)), NEVER).pipe(whenRegistrationClosedFinalize) as Observable<Observable<AbstractInvocationRequest>>;
        });

        let result =
            merge(sending$, expectRegisteredOrError$)
                .pipe(takeWhile(x => x !== null))
                .pipe(failOnError, take(1))
                .pipe(whenRegisteredReceived)
                .pipe(catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                }));
        return result;
    }

    publish$({options, args, kwargs, name}: WampusPublishArguments): Observable<void> {
        options = options || {};
        let features = this._welcomeDetails.roles.broker.features;
        if ((options.eligible || options.eligible_authid || options.eligible_authrole
            || options.exclude || options.exclude_authid || options.exclude_authrole) && !features.subscriber_blackwhite_listing) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.SubscriberBlackWhiteListing));
        }
        if (options.disclose_me && !features.publisher_identification) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.PublisherIdentification));
        }
        if (!options.exclude_me && !features.publisher_exclusion) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.PublisherExclusion));
        }
        return defer(() => {
            let msg = factory.publish(options, name, args, kwargs);
            let expectAcknowledge$: Observable<any>;
            if (options.acknowledge) {
                let expectPublishedOrError$ = this._messenger.expectAny$(
                    Routes.published(msg.requestId),
                    Routes.error(WampType.PUBLISH, msg.requestId)
                ).pipe(catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        throw new WampusNetworkError("Cannot receive publish acknowledgement because session is closing.");
                    }
                    throw err;
                }));
                let failOnError = map((response: WM.Any) => {
                    if (response instanceof WM.Error) {
                        this._throwCommonError(msg, response);
                        throw new WampusIllegalOperationError("Failed to publish.", {
                            msg: response
                        });
                    }
                    return response;
                });
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
    event$({options, event}: WampusSubcribeArguments): Observable<Observable<AbstractEventArgs>> {
        options = options || {};
        let features = this._welcomeDetails.roles.broker.features;
        if (options.match && !features.pattern_based_subscription) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.PatternBasedSubscription));
        }

        let expectSubscribedOrError = defer(() => {
            let msg = factory.subscribe(options, event);
            let sending$ = this._messenger.send$(msg);
            let expectSubscribedOrError$ = this._messenger.expectAny$(
                Routes.subscribed(msg.requestId),
                Routes.error(WampType.SUBSCRIBE, msg.requestId)
            );
            let failOnErrorOrCastToSubscribed = map((x: WM.Any) => {
                if (x instanceof WM.Error) {
                    this._throwCommonError(msg, x);
                    throw Errs.Subscribe.other(event, msg);
                }
                return x as WM.Subscribed;
            });
            return merge(sending$, expectSubscribedOrError$).pipe(failOnErrorOrCastToSubscribed);
        });

        let whenSubscribedStreamEvents = flatMap((subscribed: WM.Subscribed) => {
            let unsub = factory.unsubscribe(subscribed.subscriptionId);
            let expectEvents$ = this._messenger.expectAny$(Routes.event(subscribed.subscriptionId));
            let finalizeOnClose = this._finalizeInUnsubscribe$(async () => {
                if (this._isClosing) return;
                let expectUnsubscribedOrError$ = this._messenger.expectAny$(
                    Routes.unsubscribed(subscribed.subscriptionId),
                    Routes.error(WampType.UNSUBSCRIBE, unsub.requestId)
                );

                let failOnUnsubscribedError = map((msg: WM.Any) => {
                    if (msg instanceof WampMessage.Error) {
                        this._throwCommonError(unsub, msg);
                        switch (msg.error) {
                            case WampUri.Error.NoSuchSubscription:
                                throw Errs.Unsubscribe.subDoesntExist(msg, event);
                            default:
                                throw Errs.Unsubscribe.other(msg, event);
                        }
                    }
                    return msg as WM.Unsubscribed;
                });

                let sendUnsub$ = this._messenger.send$(unsub);

                let total = merge(sendUnsub$, expectUnsubscribedOrError$).pipe(failOnUnsubscribedError, take(1), catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                }));
                return total.toPromise();
            });

            let mapToLibraryEvent = map((x: WM.Event) => {
                let a: AbstractEventArgs = {
                    args: x.args,
                    details: x.details,
                    kwargs: x.kwargs,
                    name: event
                };
                return a;
            });
            return concat(of(expectEvents$.pipe(mapToLibraryEvent)), NEVER).pipe(finalizeOnClose).pipe(catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    return EMPTY;
                }
                throw err;
            })) as Observable<Observable<AbstractEventArgs>>;
        });

        return expectSubscribedOrError.pipe(take(1), whenSubscribedStreamEvents)
    }

    call$({options, name, args, kwargs}: WampusCallArguments): Observable<AbstractCallResult> {
        options = options || {};
        let self = this;
        let features = this._welcomeDetails.roles.dealer.features;
        if (options.disclose_me && !features.caller_identification) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallerIdentification));
        }
        if (options.cancelMode && !features.call_cancelling) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallCancelling));
        }
        if (options.receive_progress && !features.progressive_call_results) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Call.ProgressReports));
        }
        if (options.timeout && !features.call_timeout) {
            return throwError(Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallTimeouts));
        }

        return defer(() => {
            let msg = factory.call(options, name, args, kwargs);
            let isRunning = true;


            let unmarkRunningIfResultReceived = tap((x: WM.Any) => {
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
            ).pipe(catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    throw new WampusNetworkError("Invocation cancelled because session is closing.", {});
                }
                throw err;
            }));

            let finalizeOnCancel = this._finalizeInUnsubscribe$(async () => {
                // If a result is already received, do not try to cancel the call.
                if (!isRunning) return;
                if (this._isClosing) return;
                let cancel = factory.cancel(msg.requestId, {
                    mode: options.cancelMode || CancelMode.Kill
                });
                let sendCancel$ = this._messenger.send$(cancel);

                let handleOnCancelResponse = tap((msg: WM.Any) => {
                    if (msg instanceof WampMessage.Error) {
                        this._throwCommonError(cancel, msg);
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

                return merge(sendCancel$, expectResultOrError$).pipe(handleOnCancelResponse, take(1), catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                })).toPromise();
            });

            let cancellableStage$ = NEVER.pipe(finalizeOnCancel);


            let failOnError = map((x: WM.Any) => {
                if (x instanceof WampMessage.Error) {
                    this._throwCommonError(msg, x);
                    switch (x.error) {
                        case WampUri.Error.NoSuchProcedure:
                            throw Errs.Call.noSuchProcedure(msg.procedure);
                        case WampUri.Error.NoEligibleCallee:
                            throw Errs.Call.noEligibleCallee(msg.procedure);
                        case WampUri.Error.DisallowedDiscloseMe:
                            throw Errs.Call.optionDisallowedDiscloseMe(msg.procedure);
                    }
                    if (x.error === WampUri.Error.RuntimeError || !x.error.startsWith(WampUri.Error.Prefix)) {
                        throw Errs.Call.errorResult(name, x);
                    }
                    throw Errs.Call.other(name, x);
                }
                return x as WM.Result;
            });

            let toLibraryResult = map((x: WM.Any) => {
                if (x instanceof WampMessage.Result) {
                    return {
                        args: x.args,
                        kwargs: x.kwargs,
                        isProgress: x.details.progress,
                        details: x.details,
                        name: name
                    } as AbstractCallResult;
                }
                throw new Error("Unknown message.");
            });

            let sending$ = this._messenger.send$(msg);

            let exp = merge(concat(sending$, cancellableStage$), expectResultOrError$.pipe(unmarkRunningIfResultReceived)).pipe(failOnError).pipe(toLibraryResult) as Observable<AbstractCallResult>;
            let exp2 = exp.pipe(switchMap((msg: WM.Result) => {
                if (msg.details.progress) {
                    return of(msg);
                } else {
                    return of(msg, null)
                }
            })).pipe(takeWhile(m => !!m)) as Observable<AbstractCallResult>;
            return exp2;
        });
    }

    async close(): Promise<void> {
        await this._close$({}, WampUri.CloseReason.GoodbyeAndOut, false).toPromise();
    }

    private _finalizeInUnsubscribe$<T>(finalizer: () => Promise<any>): OperatorFunction<T, T> {
        return finalize(finalizer);
    }

    private _throwCommonError(source: WampMessage.Any, err: WampMessage.Error) {
        let operation = WampType[source.type];
        switch (err.error) {
            case WampUri.Error.NotAuthorized:
                throw Errs.notAuthorized(operation, err);
            case WampUri.Error.InvalidUri:
                throw Errs.invalidUri(operation, err);
            case WampUri.Error.NetworkFailure:
                throw Errs.networkFailure(operation, err);
            case WampUri.Error.OptionNotAllowed:
                throw Errs.optionNotAllowed(operation, err);
        }
    }

    private _close$(details: WampObject, reason: WampUriString, abrupt: boolean): Observable<any> {
        if (this._isClosing) return EMPTY;
        this._isClosing = true;
        if (abrupt) {
            return concat(this._closeRoutes(new WampusRouteCompletion(WampusCompletionReason.SelfAbort)), this._abort$(details, reason));
        }

        let timeout = timer(this.config.timeout).pipe(flatMap(() => {
            throw Errs.Leave.goodbyeTimedOut();
        }));

        let expectGoodbyeOrTimeout = merge(this._goodbye$(details, reason), timeout).pipe(catchError(err => {
            if (err instanceof WampusNetworkError) {
                return EMPTY;
            }
            console.warn("Error when saying GOODBYE. Going to say ABORT.", err);
            return this._abort$(details, reason);
        }));

        return concat(this._closeRoutes(new WampusRouteCompletion(WampusCompletionReason.SelfGoodbye)), expectGoodbyeOrTimeout);
    }

    private _abortDueToProtoViolation(message: string) {
        return this._close$({
            message
        }, WampUri.Error.ProtoViolation, true);
    }

    private _closeRoutes(err: WampusRouteCompletion) {
        return defer(async () => {
            this._messenger.invalidateAllRoutes(err);
            await MyPromise.wait(0);
            this._disconnecting.next(err);
            await MyPromise.wait(0);
        }).pipe(flatMap(() => {
            return EMPTY;
        }));
    }

    private _handleClose$(msg: WampMessage.Goodbye | WampMessage.Abort) {
        if (this._isClosing) return;
        this._isClosing = true;
        let reason: WampusRouteCompletion;
        if (msg instanceof WampMessage.Abort) {
            return this._closeRoutes(new WampusRouteCompletion(WampusCompletionReason.RouterAbort, msg));
        }
        else {
            let echo$ = this._messenger.send$(factory.goodbye({
                message: "Goodbye received"
            }, WampUri.CloseReason.GoodbyeAndOut));

            let x = concat(echo$, this._closeRoutes(new WampusRouteCompletion(WampusCompletionReason.RouterGoodbye, msg)));
            return x;
        }
    }


    private _abort$(details: WampObject, reason: WampUriString) {
        let errorOnTimeout = timeoutWith(this.config.timeout, throwError(Errs.Leave.networkErrorOnAbort(new Error("Timed Out"))));
        let sending$ = this._messenger.send$(factory.abort(details, reason));
        let all$ = sending$.pipe(errorOnTimeout, catchError(() => {
            console.warn("Network error on ABORT.");
            return EMPTY;
        }));
        return concat(all$);
    }

    private _goodbye$(details: WampObject, reason: WampUriString) {
        let myGoodbye = factory.goodbye(details, reason);
        let sending$ = this._messenger.send$(myGoodbye);
        let expectingByeOrError$ = this._messenger.expectAny$(
            Routes.goodbye,
            Routes.error(WampType.GOODBYE)
        );

        let failOnError = map((x: WM.Any) => {
            if (x instanceof WampMessage.Error) {
                throw Errs.Leave.errorOnGoodbye(x);
            }
            return x as WampMessage.Goodbye;
        });

        return merge(sending$, concat(expectingByeOrError$).pipe(failOnError));
    }

    private _handshake$(): Observable<WM.Welcome> {
        let messenger = this._messenger;
        let config = this.config;
        let hello = factory.hello(config.realm, {
            roles: {
                callee: {},
                caller: {},
                publisher: {},
                subscriber: {}
            }
        });

        let handleMessage = map((msg: WM.Any) => {
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
                throw Errs.routerDoesNotSupportFeature("CHALLENGE authentication", msg);
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
        let serverInitiatedClose$ = this._messenger.expectAny$([WampType.ABORT], [WampType.GOODBYE]).pipe(take(1), flatMap((x: WM.Abort) => {
            return this._handleClose$(x);
        }));

        let serverSentInvalidMessage$ = this._messenger.expectAny$(
            [WampType.WELCOME],
            [WampType.CHALLENGE]
        ).pipe(flatMap(x => {
            return this._abortDueToProtoViolation(`Received unexpected message of type ${WampType[x.type]}.`);
        }));

        let serverSentRouterMessage$ = this._messenger.expectAny$(
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
        ).pipe(flatMap(x => {
            return this._abortDueToProtoViolation(`Received message of type ${WampType[x.type]}, which is meant for routers not peers.`);
        }));

        return merge(serverSentInvalidMessage$, serverSentRouterMessage$, serverInitiatedClose$);
    }


}