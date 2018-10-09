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
import {WampusError, WampusIllegalOperationError, WampusNetworkError} from "../errors/types";
import {WebsocketTransport} from "./messaging/transport/websocket";
import {Routes} from "./messaging/routing/route-helpers";
import {CancelMode, InvocationPolicy, WampSubscribeOptions, WelcomeDetails} from "../protocol/options";
import {WampMessenger} from "./messaging/wamp-messenger";
import {AbstractCallResult, AbstractEventArgs, AbstractInvocationRequest} from "./methods/methods";
import {
    concat,
    defer,
    EMPTY,
    merge,
    NEVER,
    Observable,
    of,
    OperatorFunction, race,
    ReplaySubject,
    Subject,
    throwError,
    timer
} from "rxjs";
import {
    catchError, endWith,
    finalize,
    flatMap,
    map,
    mapTo,
    mergeMapTo,
    publish,
    take,
    takeUntil,
    takeWhile,
    tap,
    timeoutWith,
} from "rxjs/operators";
import {
    WampusCallArguments,
    WampusPublishArguments,
    WampusRegisterArguments,
    WampusSendErrorArguments,
    WampusSendResultArguments,
    WampusSubcribeArguments
} from "./api-parameters";
import {MyPromise} from "../ext-promise";
import {fromPromise} from "rxjs/internal-compatibility";
import {CallProgress, EventSubscription, Registration} from "./api-types";
import {completeOnError, publishAutoConnect, skipAfter} from "../utils/rxjs";

export interface SessionConfig {
    realm: string;
    timeout: number;
}

import WM = WampMessage;
import CallSite = NodeJS.CallSite;
import {endianness} from "os";
import {Transport} from "./messaging/transport/transport";
import {wampusHelloDetails} from "./hello-details";

let factory = new MessageBuilder(() => Math.floor(Math.random() * (2 << 50)));

export interface ReportedErrorDuringFinalize {
    error: WampusError;
    trace: CallSite[];
}

export type AsyncCloseableObservable<T> = Observable<T> & {
    close(): Promise<void>;
}

export class Session {
    id: number;
    config: SessionConfig;
    public _messenger: WampMessenger;
    private _welcomeDetails: WelcomeDetails;
    private _disconnecting = Subject.create();
    private _isClosing = false;

    constructor(never: never) {

    }

    get realm() {
        return this.config.realm;
    }

    get isActive() {
        return !this._isClosing;
    }

    get details() {
        return this._welcomeDetails;
    }

    static async create(config: SessionConfig & { transport: Promise<Transport> | Transport }): Promise<Session> {
        // 1. Receive transport
        // 2. Handshake
        // 3. Wait until session closed:
        //      On close: Initiate goodbye sequence.
        let transport = await config.transport;

        let messenger = WampMessenger.create(transport);
        let session = new Session(null as never);
        session.config = config;
        session._messenger = messenger;
        let getSessionFromShake$ = session._handshake$().pipe(map(welcome => {
            session.id = welcome.sessionId;
            session._welcomeDetails = welcome.details;
            session._registerRoutes().subscribe();
        }));
        return concat(getSessionFromShake$).pipe(mapTo(session), take(1)).toPromise();
    }

    async register({options, name}: WampusRegisterArguments): Promise<Registration> {
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
        if (!this.isActive) throw Errs.sessionClosed("call procedure");

        options = options || {};
        let msg = factory.register(options, name);

        let {_welcomeDetails} = this;
        let features = _welcomeDetails.roles.dealer.features;
        // Make sure the router's WELCOME message supports all the features specified in options and throw an error otherwise.
        if (options.disclose_caller && !features.caller_identification) {
            throw Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallerIdentification);
        }
        if (options.match && !features.pattern_based_registration) {
            throw Errs.routerDoesNotSupportFeature(AdvProfile.Call.PatternRegistration);
        }
        if (options.invoke && options.invoke !== InvocationPolicy.Single && !features.shared_registration) {
            throw Errs.routerDoesNotSupportFeature(AdvProfile.Call.SharedRegistration);
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
        let whenRegisteredReceived = map((registered: WM.Registered) => {
            // Expect INVOCATION message
            let expectInvocation$ = this._messenger.expectAny$(Routes.invocation(registered.registrationId)).pipe(catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    return EMPTY;
                }
                throw err;
            }), takeUntil(this._messenger.expect$(Routes.unregistered(registered.registrationId))));
            let registrationClosing = false;
            // Finalize by closing the REGISTRATION when the outer observable is abandoned.
            let close = async () => {
                if (registrationClosing) return;
                registrationClosing = true;
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
                                throw Errs.Unregister.registrationDoesntExist(name, x);
                            default:
                                throw Errs.Unregister.other(name, x);
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
            };

            // Operator - Received INVOCATION message.
            let whenInvocationReceived = map((msg: WM.Invocation) => {
                // Expect INTERRUPT message for cancellation
                let expectInterrupt$ = this._messenger.expectAny$([WampType.INTERRUPT, msg.requestId]).pipe(map(x => x as WM.Interrupt));
                let isHandled = false;

                // Send message
                let send$ = (msg: WampMessage.Any) => {
                    if (msg instanceof WampMessage.Error || msg instanceof WampMessage.Yield && !msg.options.progress) {
                        if (isHandled) {
                            return throwError(Errs.Register.cannotSendResultTwice(name));
                        } else {
                            isHandled = true;
                        }
                    }
                    return this._messenger.send$(msg);
                };
                let req: AbstractInvocationRequest = {
                    error({args, reason, kwargs, options}: WampusSendErrorArguments) {
                        return send$(factory.error(WampType.INVOCATION, msg.requestId, options, reason, args, kwargs)).toPromise();
                    },
                    return({args, kwargs, options}: WampusSendResultArguments) {
                        return send$(factory.yield(msg.requestId, options, args, kwargs)).toPromise();
                    },
                    waitCancel(time = 0) {
                        let waitForTime = takeUntil(timer(time));
                        let throwCancel$ = throwError(Errs.Invocation.cancelled())
                        let handleInterrupt = flatMap((x: WampMessage.Any) => {
                            return concat(this.error$({
                                reason: WampUri.Error.Canceled
                            }), throwCancel$);
                        });

                        return expectInterrupt$.pipe(waitForTime).pipe(handleInterrupt).toPromise().then(() => {
                        });
                    },
                    args: msg.args,
                    kwargs: msg.kwargs,
                    options: msg.options,
                    name: name
                };
                return req;
            });

            let invocations = expectInvocation$.pipe(whenInvocationReceived);
            let reg: Registration = {
                invocations: invocations.pipe(publishAutoConnect()),
                async close() {
                    await close()
                }
            };
            return reg;
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
        return result.toPromise();
    }

    async publish({options, args, kwargs, name}: WampusPublishArguments): Promise<void> {
        if (!this.isActive) throw Errs.sessionClosed("publish");

        options = options || {};
        let features = this._welcomeDetails.roles.broker.features;
        if ((options.eligible || options.eligible_authid || options.eligible_authrole
            || options.exclude || options.exclude_authid || options.exclude_authrole) && !features.subscriber_blackwhite_listing) {
            throw Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.SubscriberBlackWhiteListing);
        }
        if (options.disclose_me && !features.publisher_identification) {
            throw Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.PublisherIdentification);
        }
        if (!options.exclude_me && !features.publisher_exclusion) {
            throw Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.PublisherExclusion);
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
        }).toPromise();
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
    async event({options, name}: WampusSubcribeArguments): Promise<EventSubscription> {
        if (!this.isActive) throw Errs.sessionClosed("event unsubscribe");

        options = options || {};
        let features = this._welcomeDetails.roles.broker.features;
        if (options.match && !features.pattern_based_subscription) {
            throw Errs.routerDoesNotSupportFeature(AdvProfile.Subscribe.PatternBasedSubscription);
        }

        let expectSubscribedOrError = defer(() => {
            let msg = factory.subscribe(options, name);
            let sending$ = this._messenger.send$(msg);
            let expectSubscribedOrError$ = this._messenger.expectAny$(
                Routes.subscribed(msg.requestId),
                Routes.error(WampType.SUBSCRIBE, msg.requestId)
            );
            let failOnErrorOrCastToSubscribed = map((x: WM.Any) => {
                if (x instanceof WM.Error) {
                    this._throwCommonError(msg, x);
                    throw Errs.Subscribe.other(name, msg);
                }
                return x as WM.Subscribed;
            });
            return merge(sending$, expectSubscribedOrError$).pipe(failOnErrorOrCastToSubscribed);
        });

        let whenSubscribedStreamEvents = map((subscribed: WM.Subscribed) => {
            let unsub = factory.unsubscribe(subscribed.subscriptionId);
            let expectEvents$ = this._messenger.expectAny$(Routes.event(subscribed.subscriptionId));
            let close = async () => {
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
                                throw Errs.Unsubscribe.subDoesntExist(msg, name);
                            default:
                                throw Errs.Unsubscribe.other(msg, name);
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
            };

            let mapToLibraryEvent = map((x: WM.Event) => {
                let a: AbstractEventArgs = {
                    args: x.args,
                    details: x.details,
                    kwargs: x.kwargs,
                    name: name
                };
                return a;
            });

            return {
                async close() {
                    await close();
                },
                events: expectEvents$.pipe(mapToLibraryEvent).pipe(catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                }))
            } as EventSubscription
        });

        return expectSubscribedOrError.pipe(take(1), whenSubscribedStreamEvents).toPromise();
    }

    call({options, name, args, kwargs}: WampusCallArguments): CallProgress {
        try {
            if (!this.isActive) throw Errs.sessionClosed("call procedure");
            options = options || {};
            let self = this;
            let features = this._welcomeDetails.roles.dealer.features;

            // Check call options are compatible with the deaqler's features.
            if (options.disclose_me && !features.caller_identification) {
                throw Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallerIdentification);
            }
            if (options.receive_progress && !features.progressive_call_results) {
                throw Errs.routerDoesNotSupportFeature(AdvProfile.Call.ProgressReports);
            }
            if (options.timeout && !features.call_timeout) {
                throw Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallTimeouts);
            }

            /*
                Goes like this:
                * Send a CALL message
                * Await a RESULT or ERROR response.
                - If received a RESULT.PROGRESS = false response, complete the progress stream.

                On CANCEL:
                1. Wait until CALL message is delivered
                2. Force complete progress stream
                3. Send a CANCEL message
                4. Wait for a RESULT or ERROR response
                5.
             */
            let cantCancel = false;
            let msg = factory.call(options, name, args, kwargs);

            let failOnError = map((x: WM.Any) => {
                cantCancel = true;
                if (x instanceof WampMessage.Error) {
                    this._throwCommonError(msg, x);
                    switch (x.error) {
                        case WampUri.Error.NoSuchProcedure:
                            throw Errs.Call.noSuchProcedure(msg.procedure);
                        case WampUri.Error.NoEligibleCallee:
                            throw Errs.Call.noEligibleCallee(msg.procedure);
                        case WampUri.Error.DisallowedDiscloseMe:
                            throw Errs.Call.optionDisallowedDiscloseMe(msg.procedure);
                        case WampUri.Error.Canceled:
                            throw Errs.Call.canceled(name);
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
                        isProgress: x.details.progress || false,
                        details: x.details,
                        name: name
                    } as AbstractCallResult;
                }
                throw new Error("Unknown message.");
            });
            let expectResultOrError = self._messenger.expectAny$(
                Routes.result(msg.requestId),
                Routes.error(WampType.CALL, msg.requestId)
            ).pipe(failOnError, catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    throw new WampusNetworkError("Invocation cancelled because session is closing.", {});
                }
                throw err;
            }), toLibraryResult, publishAutoConnect());

            let sending = this._messenger.send$(msg).pipe(publishAutoConnect());

            let allStream =
                merge(expectResultOrError, this._messenger.send$(msg))
                    .pipe(skipAfter((x: AbstractCallResult) => !x.isProgress));

            let startCancelling = mode => defer(async () => {
                // If a result is already received, do not try to cancel the call.
                if (!features.call_cancelling) {
                    throw Errs.routerDoesNotSupportFeature(AdvProfile.Call.CallCancelling);
                }
                if (this._isClosing) return;
                let cancel = factory.cancel(msg.requestId, {
                    mode: mode
                });
                let sendCancel$ = this._messenger.send$(cancel);

                return merge(sendCancel$, self._messenger.expectAny$(
                    Routes.result(msg.requestId),
                    Routes.error(WampType.CALL, msg.requestId)
                ).pipe(catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                }), map(msg => {
                    if (msg instanceof WM.Result) {
                        //TODO: Remove this log
                        console.log("Tried to cancel, but received RESULT.")
                    } else if (msg instanceof WM.Error) {
                        this._throwCommonError(cancel, msg);
                        if (msg.error !== WampUri.Error.Canceled) {
                            throw new WampusIllegalOperationError("While cancelling, received error.", {
                                msg
                            })
                        }
                        return;
                    }
                    else {
                        throw Error("Unexpected!");
                    }
                })).toPromise());
            });

            let prog: CallProgress = {
                progress: allStream.pipe(publishAutoConnect()),
                close(mode ?: CancelMode) {
                    cantCancel = true;
                    let stopWhenReceived = expectResultOrError.pipe(endWith(null), completeOnError());
                    return concat(sending, startCancelling(mode || CancelMode.Kill)).pipe(takeUntil(stopWhenReceived)).toPromise().then(() => {
                    });
                }
            };

            return prog;
        }
        catch (err) {
            return {
                async close() {

                },
                progress: throwError(err)
            } as CallProgress;
        }
    }

    async close(): Promise<void> {
        await this._close$({}, WampUri.CloseReason.GoodbyeAndOut, false).toPromise();
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

        let expectGoodbyeOrTimeout = race(this._goodbye$(details, reason), timeout).pipe(catchError(err => {
            if (err instanceof WampusNetworkError) {
                return EMPTY;
            }
            console.warn("Error when saying GOODBYE. Going to say ABORT.", err);
            return this._abort$(details, reason);
        }), take(1));

        return concat(this._closeRoutes(new WampusRouteCompletion(WampusCompletionReason.SelfGoodbye)), expectGoodbyeOrTimeout, defer(async () => {
            return this._messenger.transport.close();
        }));
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
        if (this._isClosing) return EMPTY;
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
        let expectingByeOrError$ = this._messenger.expectNext$();

        let failOnError = map((x: WM.Any) => {
            if (x instanceof WampMessage.Error) {
                throw Errs.Leave.errorOnGoodbye(x);
            }
            else if (x instanceof WampMessage.Goodbye) {
                return x as WampMessage.Goodbye;
            }
            throw Errs.Leave.unexpectedMessageOnGoodbye(x);

        });

        return merge(sending$, concat(expectingByeOrError$).pipe(failOnError));
    }

    private _handshake$(): Observable<WM.Welcome> {
        let messenger = this._messenger;
        let config = this.config;
        let hello = factory.hello(config.realm, {
            ...wampusHelloDetails
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
        let catchCompletionError = catchError(err => {
            if (err instanceof WampusRouteCompletion) return EMPTY;
            throw err;
        });
        let serverInitiatedClose$ = this._messenger.expectAny$([WampType.ABORT], [WampType.GOODBYE]).pipe(take(1), flatMap((x: WM.Abort) => {
            return this._handleClose$(x);
        }), catchCompletionError);

        let serverSentInvalidMessage$ = this._messenger.expectAny$(
            [WampType.WELCOME],
            [WampType.CHALLENGE]
        ).pipe(flatMap(x => {
            return this._abortDueToProtoViolation(`Received unexpected message of type ${WampType[x.type]}.`);
        }), catchCompletionError);

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
        }), catchCompletionError);

        return merge(serverSentInvalidMessage$, serverSentRouterMessage$, serverInitiatedClose$);
    }


}