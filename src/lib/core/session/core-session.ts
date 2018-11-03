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
import {WampusNetworkError} from "../errors/types";
import {Routes} from "../protocol/routes";
import {CancelMode, HelloDetails, InvocationPolicy, WampSubscribeOptions, WelcomeDetails} from "../protocol/options";
import {WampProtocolClient} from "../protocol/wamp-protocol-client";
import {
	CallResultData,
	CallTicket,
	CancellationToken,
	EventInvocationData,
	EventSubscriptionTicket,
	ProcedureInvocationTicket,
	ProcedureRegistrationTicket
} from "./ticket";
import {concat, defer, EMPTY, merge, Observable, of, onErrorResumeNext, race, Subject, throwError, timer} from "rxjs";
import {catchError, flatMap, map, mapTo, mergeMapTo, take, takeUntil, takeWhile, timeoutWith,} from "rxjs/operators";
import {
	WampusCallArguments,
	WampusPublishArguments,
	WampusRegisterArguments,
	WampusSendErrorArguments,
	WampusSendResultArguments,
	WampusSubcribeArguments
} from "./message-arguments";
import {MyPromise} from "../../utils/ext-promise";
import {publishAutoConnect, publishReplayAutoConnect, skipAfter} from "../../utils/rxjs-operators";
import {Transport} from "../transport/transport";
import {wampusHelloDetails} from "../hello-details";
import {MessageReader} from "../protocol/reader";
import {DefaultMessageFactory} from "./default-factory";
import {AuthenticationWorkflow, ChallengeEvent} from "./authentication";
import {fromPromise} from "rxjs/internal-compatibility";

export interface CoreSessionConfig {
    realm: string;
    timeout: number;

    helloDetails?(defaults: HelloDetails): void;
}

import _ = require("lodash");
import WM = WampMessage;

let factory = DefaultMessageFactory;

export type TransportFactory = () => (Promise<Transport> | Transport);

export interface WampusSessionDependencies {
    transport: TransportFactory;
    authenticator?: AuthenticationWorkflow;
}

export class WampusCoreSession {
    sessionId: number;
    config: CoreSessionConfig;
    protocol: WampProtocolClient<WampMessage.Any>;
    private _welcomeDetails: WelcomeDetails;
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

    static async create(config: CoreSessionConfig & WampusSessionDependencies): Promise<WampusCoreSession> {
        // 1. Receive transport
        // 2. Handshake
        // 3. Wait until session closed:
        //      On close: Initiate goodbye sequence.
        let transport = await config.transport();
        let reader = new MessageReader();
        let messenger = WampProtocolClient.create<WampMessage.Any>(transport, x => reader.parse(x));
        let session = new WampusCoreSession(null as never);
        session.config = config;
        session.protocol = messenger;
        let serverDroppedConnection$ = onErrorResumeNext(messenger.onClosed.pipe(flatMap(x => {
            return concat(timer(0), defer(() => {
                messenger.invalidateAllRoutes(new WampusRouteCompletion(WampusCompletionReason.RouterDisconnect));
                session._isClosing = true;
                return;
            }))
        })), EMPTY);
        serverDroppedConnection$.subscribe();
        let getSessionFromShake$ = session._handshake$(config.authenticator).pipe(map(welcome => {
            session.sessionId = welcome.sessionId;
            session._welcomeDetails = welcome.details;
            session._registerRoutes().subscribe();
        }));
        return concat(getSessionFromShake$).pipe(mapTo(session), take(1)).toPromise();
    }

    async register(full: WampusRegisterArguments): Promise<ProcedureRegistrationTicket> {
        let {options, name} = full;
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
	    let msg = factory.register(options, name);

	    if (!this.isActive) throw Errs.sessionClosed(msg);

        options = options || {};

        let {_welcomeDetails} = this;
        let features = _welcomeDetails.roles.dealer.features;
        // Make sure the router's WELCOME message supports all the features specified in options and throw an error otherwise.
        if (options.disclose_caller && !features.caller_identification) {
            throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Call.CallerIdentification);
        }
        if (options.match && !features.pattern_based_registration) {
            throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Call.PatternRegistration);
        }
        if (options.invoke && options.invoke !== InvocationPolicy.Single && !features.shared_registration) {
            throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Call.SharedRegistration);
        }
        let sending$ = this.protocol.send$(msg).pipe(mergeMapTo(EMPTY));

        // Expect a [REGISTERED] or [ERROR, REGISTER] message
        let expectRegisteredOrError$ = this.protocol.expectAny$(
            Routes.registered(msg.requestId),
            Routes.error(WampType.REGISTER, msg.requestId)
        ).pipe(catchError(err => {
            if (err instanceof WampusRouteCompletion) {
                throw Errs.sessionIsClosing(msg);
            }
            throw err;
        }));

        // Operator - in case of an ERROR message, throw an exception.
        let failOnError = map((x: WampMessage) => {
            if (x instanceof WampMessage.Error) {
                this._throwCommonError(msg, x);
                switch (x.error) {
                    case WampUri.Error.ProcAlreadyExists:
                        throw Errs.Register.procedureAlreadyExists(msg.procedure, x);
                    default:
                        throw Errs.Register.error(msg.procedure, x);
                }
            }
            return x as WampMessage.Registered;
        });

        let signalUnregistered = new Subject();
        // Operator - When Registered message is received, start listening for invocations.
        let whenRegisteredReceived = map((registered: WM.Registered) => {
            // Expect INVOCATION message
            let expectInvocation$ = this.protocol.expectAny$(Routes.invocation(registered.registrationId)).pipe(catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    closing = Promise.resolve();
                    return EMPTY;
                }
                throw err;
            }), takeUntil(signalUnregistered));
            let closing: Promise<any>;
            // Finalize by closing the REGISTRATION when the outer observable is abandoned.
            let close = async () => {
                if (this._isClosing) return;
                let unregisterMsg = factory.unregister(registered.registrationId);
                let sendingUnregister$ = this.protocol.send$(unregisterMsg);

                // Wait for a UNREGISTERED or ERROR;UNREGISTER message.
                let receivedUnregistered$ = this.protocol.expectAny$(Routes.unregistered(unregisterMsg.requestId), Routes.error(WampType.UNREGISTER, unregisterMsg.requestId));
                let failOnUnregisterError = map((x: WM.Any) => {
                    signalUnregistered.next();

                    if (x instanceof WampMessage.Error) {
                        this._throwCommonError(unregisterMsg, x);
                        switch (x.error) {
                            case WampUri.Error.NoSuchRegistration:
                                throw Errs.Unregister.registrationDoesntExist(name, x);
                            default:
                                throw Errs.Unregister.other(name, x);
                        }
                    }
                    signalUnregistered.next();
                    return x as WM.Unregistered;
                });

                // Send UNREGISTER and listen for messages at the same time
                return merge(sendingUnregister$, receivedUnregistered$).pipe(failOnUnregisterError, take(1), catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                })).toPromise();
            };

            // Operator - Received INVOCATION message.
            let whenInvocationReceived = map((invocationMsg: WM.Invocation) => {
                // Expect INTERRUPT message for cancellation
                let completeInterrupt = new Subject();
                let expectInterrupt =
                    this.protocol.expectAny$([WampType.INTERRUPT, invocationMsg.requestId])
                        .pipe(map(x => x as WM.Interrupt), map(x => {
                            return {
                                received: new Date(),
                                options: x.options,
                                source: procInvocationTicket
                            } as CancellationToken;
                        }), take(1), takeUntil(completeInterrupt), catchError(err => {
                            if (err instanceof WampusRouteCompletion) {
                                return EMPTY;
                            }
                            throw err;
                        }), publishReplayAutoConnect());
                let isHandled = false;
                // Send message
                let send$ = (msg: WampMessage.Any) => {
                    if (!this.isActive) return throwError(Errs.sessionIsClosing(msg));
                    if (msg instanceof WampMessage.Yield && msg.options.progress) {
                        if (!invocationMsg.options.receive_progress) {
                            return throwError(Errs.Register.doesNotSupportProgressReports(name));
                        }
                    }
                    if (isHandled) {
                        return throwError(Errs.Register.cannotSendResultTwice(name));
                    }
                    if (msg instanceof WampMessage.Error || msg instanceof WampMessage.Yield && !msg.options.progress) {
                        completeInterrupt.next();
                        isHandled = true
                    }
                    return this.protocol.send$(msg);
                };

                let procInvocationTicket: ProcedureInvocationTicket = {
                    source: procRegistrationTicket,
                    error({args, error, kwargs, options}: WampusSendErrorArguments) {
                        return send$(factory.error(WampType.INVOCATION, invocationMsg.requestId, options, error, args, kwargs)).toPromise();
                    },
                    return({args, kwargs, options}: WampusSendResultArguments) {
                        return send$(factory.yield(invocationMsg.requestId, options, args, kwargs)).toPromise();
                    },
                    progress(args) {
                        args.options = args.options || {};
                        args.options.progress = true;
                        return this.return(args);
                    },
                    get isHandled() {
                        return isHandled;
                    },
                    get cancellation() {
                        return expectInterrupt;
                    },
                    args: invocationMsg.args,
                    kwargs: invocationMsg.kwargs,
                    options: invocationMsg.options,
                    name: invocationMsg.options.procedure || name,
                    invocationId: invocationMsg.requestId
                };
                return procInvocationTicket;
            });

            let invocations$ = expectInvocation$.pipe(whenInvocationReceived);
            let procRegistrationTicket: ProcedureRegistrationTicket = {
                invocations: invocations$.pipe(publishAutoConnect()),
                close() {
                    if (closing) return closing;
                    closing = close();
                    return closing;
                },
                info: {
                    ...full,
                    registrationId: registered.registrationId
                },
                get isOpen() {
                    return !closing;
                }
            };
            return procRegistrationTicket;
        });

        let result =
            merge(sending$, expectRegisteredOrError$)
                .pipe(takeWhile(x => x !== null))
                .pipe(failOnError, take(1))
                .pipe(whenRegisteredReceived);
        return result.toPromise();
    }

    async publish(full: WampusPublishArguments): Promise<void> {
        let {options, args, kwargs, name} = full;
	    let msg = factory.publish(options, name, args, kwargs);

	    if (!this.isActive) throw Errs.sessionClosed(msg);

        options = options || {};
        let features = this._welcomeDetails.roles.broker.features;
        if ((options.eligible || options.eligible_authid || options.eligible_authrole
            || options.exclude || options.exclude_authid || options.exclude_authrole) && !features.subscriber_blackwhite_listing) {
            throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Subscribe.SubscriberBlackWhiteListing);
        }
        if (options.disclose_me && !features.publisher_identification) {
            throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Subscribe.PublisherIdentification);
        }
        if (options.exclude_me === false && !features.publisher_exclusion) {
            throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Subscribe.PublisherExclusion);
        }
        return defer(() => {
            let expectAcknowledge$: Observable<any>;
            if (options.acknowledge) {
                let expectPublishedOrError$ = this.protocol.expectAny$(
                    Routes.published(msg.requestId),
                    Routes.error(WampType.PUBLISH, msg.requestId)
                ).pipe(take(1), catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        throw Errs.sessionIsClosing(msg);
                    }
                    throw err;
                }));
                let failOnError = map((response: WM.Any) => {
                    if (response instanceof WM.Error) {
                        this._throwCommonError(msg, response);
                        throw Errs.Publish.unknown(msg.topic, response);
                    }
                    return response;
                });
                expectAcknowledge$ = expectPublishedOrError$.pipe(failOnError, mergeMapTo(EMPTY));
            } else {
                expectAcknowledge$ = EMPTY;
            }
            let sendingPublish$ = this.protocol.send$(msg).pipe(catchError(err => {
                return EMPTY;
            }));
            return merge(sendingPublish$, expectAcknowledge$);
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
    async topic(full: WampusSubcribeArguments): Promise<EventSubscriptionTicket> {
        let {options, name} = full;
	    let msg = factory.subscribe(options, name);

	    if (!this.isActive) throw Errs.sessionClosed(msg);

        options = options || {};
        let features = this._welcomeDetails.roles.broker.features;
        if (options.match && !features.pattern_based_subscription) {
            throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Subscribe.PatternBasedSubscription);
        }

        let expectSubscribedOrError$ = defer(() => {
            let sending$ = this.protocol.send$(msg);
            let expectSubscribedOrError$ = this.protocol.expectAny$(
                Routes.subscribed(msg.requestId),
                Routes.error(WampType.SUBSCRIBE, msg.requestId)
            );
            let failOnErrorOrCastToSubscribed = map((x: WM.Any) => {
                if (x instanceof WM.Error) {
                    this._throwCommonError(msg, x);
                    throw Errs.Subscribe.other(name, x);
                }
                return x as WM.Subscribed;
            });
            return merge(sending$, expectSubscribedOrError$).pipe(failOnErrorOrCastToSubscribed);
        }).pipe(catchError(err => {
            if (err instanceof WampusRouteCompletion) {
                throw Errs.sessionIsClosing(msg);
            }
            throw err;
        }));

        let whenSubscribedStreamEvents = map((subscribed: WM.Subscribed) => {
            let unsub = factory.unsubscribe(subscribed.subscriptionId);
            let expectEvents$ = this.protocol.expectAny$(Routes.event(subscribed.subscriptionId)).pipe(catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    closing = Promise.resolve();
                    return EMPTY;
                }
                throw err;
            }));
            let closeSignal = new Subject();
            let closing: Promise<any>;
            let close = async () => {
                if (this._isClosing) return;
                let expectUnsubscribedOrError$ = this.protocol.expectAny$(
                    Routes.unsubscribed(unsub.requestId),
                    Routes.error(WampType.UNSUBSCRIBE, unsub.requestId)
                );

                let failOnUnsubscribedError = map((msg: WM.Any) => {
                    closeSignal.next();
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

                let sendUnsub$ = this.protocol.send$(unsub);

                let total = merge(sendUnsub$, expectUnsubscribedOrError$).pipe(failOnUnsubscribedError, take(1), catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                }));
                return total.toPromise();
            };

            let mapToLibraryEvent = map((x: WM.Event) => {
                let a: EventInvocationData = {
                    args: x.args,
                    details: x.details,
                    kwargs: x.kwargs,
                    source: eventSubscriptionTicket
                };
                return a;
            });

            let eventSubscriptionTicket = {
                close() {
                    if (closing) return closing;
                    closing = close();
                    return closing;
                },
                events: expectEvents$.pipe(mapToLibraryEvent).pipe(catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                }), takeUntil(closeSignal), publishAutoConnect()),
                info: {
                    subscriptionId: subscribed.subscriptionId,
                    name: name,
                    options: options
                },
                get isOpen() {
                    return !closing;
                }
            } as EventSubscriptionTicket;
            return eventSubscriptionTicket;
        });

        return expectSubscribedOrError$.pipe(take(1), whenSubscribedStreamEvents).toPromise();
    }

    call(full: WampusCallArguments): CallTicket {
        try {
            let {options, name, args, kwargs} = full;
	        let msg = factory.call(options, name, args, kwargs);

	        if (!this.isActive) throw Errs.sessionClosed(msg);
            options = options || {};
            let self = this;
            let features = this._welcomeDetails.roles.dealer.features;
            let canceling: Promise<any>;

            // Check call options are compatible with the deaqler's features.
            if (options.disclose_me && !features.caller_identification) {
                throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Call.CallerIdentification);
            }
            if (options.receive_progress && !features.progressive_call_results) {
                throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Call.ProgressReports);
            }
            if (options.timeout && !features.call_timeout) {
                throw Errs.routerDoesNotSupportFeature(msg,AdvProfile.Call.CallTimeouts);
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

            let failOnError = map((x: WM.Any) => {
                canceling = Promise.resolve();
                if (x instanceof WampMessage.Error) {
                    this._throwCommonError(msg, x);
                    switch (x.error) {
                        case WampUri.Error.NoSuchProcedure:
                            throw Errs.Call.noSuchProcedure(msg.procedure, x);
                        case WampUri.Error.NoEligibleCallee:
                            throw Errs.Call.noEligibleCallee(msg.procedure, x);
                        case WampUri.Error.DisallowedDiscloseMe:
                            throw Errs.Call.optionDisallowedDiscloseMe(msg.procedure, x);
                        case WampUri.Error.Canceled:
                            throw Errs.Call.canceled(name, x);
                        case WampUri.Error.InvalidArgument:
                            throw Errs.Call.invalidArgument(name, x);
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
                        name: name,
                        source: callTicket
                    } as CallResultData;
                }
                throw new Error("Unknown message.");
            });
            let expectResultOrError = self.protocol.expectAny$(
                Routes.result(msg.requestId),
                Routes.error(WampType.CALL, msg.requestId)
            ).pipe(failOnError, catchError(err => {
                if (err instanceof WampusRouteCompletion) {
                    throw Errs.sessionIsClosing(msg);
                }
                throw err;
            }), toLibraryResult).pipe(publishAutoConnect());

            let sending = this.protocol.send$(msg).pipe(publishAutoConnect());

            let allStream =
                merge(expectResultOrError, sending)
                    .pipe(skipAfter((x: CallResultData) => !x.isProgress));

            let startCancelling = (cancel : WM.Cancel) => defer(async () => {
                if (this._isClosing) return;
                let sendCancel$ = this.protocol.send$(cancel);

                return merge(sendCancel$, self.protocol.expectAny$(
                    Routes.result(msg.requestId),
                    Routes.error(WampType.CALL, msg.requestId)
                ).pipe(skipAfter(x => {
                    return x instanceof WM.Result && !x.details.progress || x instanceof WM.Error;
                }), catchError(err => {
                    if (err instanceof WampusRouteCompletion) {
                        return EMPTY;
                    }
                    throw err;
                }), map(msg => {

                }))).toPromise();
            });
            let progressStream = allStream.pipe(publishAutoConnect());
            let callTicket: CallTicket = {
                progress: progressStream,
                close(mode ?: CancelMode) {
	                let cancel = factory.cancel(msg.requestId, {
		                mode: mode || CancelMode.Kill
	                });
                    if (!features.call_cancelling) {
                        return Promise.reject(Errs.routerDoesNotSupportFeature(cancel,AdvProfile.Call.CallCancelling));
                    }
                    if (canceling) return canceling;
                    return canceling = concat(sending, startCancelling(cancel)).toPromise().then(() => {
                    });
                },
                get isOpen() {
                    return !!canceling;
                },
                info: {
                    ...full,
                    callId: msg.requestId
                }
            };

            return callTicket;
        }
        catch (err) {
            return {
                async close() {

                },
                progress: throwError(err),
                get isOpen() {
                    return false;
                },
                info: {
                    ...full,
                    callId: undefined
                }
            } as CallTicket;
        }
    }

    async close(): Promise<void> {
        await this._close$({}, WampUri.CloseReason.GoodbyeAndOut, false).toPromise();
    }


    private _throwCommonError(source: WampMessage.Any, err: WampMessage.Error) {
        switch (err.error) {
            case WampUri.Error.NotAuthorized:
                throw Errs.notAuthorized(source, err);
            case WampUri.Error.InvalidUri:
                throw Errs.invalidUri(source, err);
            case WampUri.Error.NetworkFailure:
                throw Errs.networkFailure(source, err);
            case WampUri.Error.OptionNotAllowed:
                throw Errs.optionNotAllowed(source, err);
        }
    }

    private _close$(details: WampObject, reason: WampUriString, abrupt: boolean): Observable<any> {
        if (this._isClosing) return EMPTY;
        this._isClosing = true;
        if (abrupt) {
            return concat(this._closeRoutes$(new WampusRouteCompletion(WampusCompletionReason.SelfAbort)), this._abort$(details, reason));
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

        return concat(this._closeRoutes$(new WampusRouteCompletion(WampusCompletionReason.SelfGoodbye)), expectGoodbyeOrTimeout, defer(async () => {
            return this.protocol.transport.close();
        }));
    }

    private _abortDueToProtoViolation(message: string) {
        return this._close$({
            message
        }, WampUri.Error.ProtoViolation, true);
    }

    private _closeRoutes$(err: WampusRouteCompletion) {
        return defer(async () => {
            this.protocol.invalidateAllRoutes(err);
            await MyPromise.wait(0);
            return 5;
        }).pipe(take(1), map(x => {
            let a = 5;
        }));
    }


    private _handleClose$(msg: WampMessage.Goodbye | WampMessage.Abort) {
        if (this._isClosing) return EMPTY;
        this._isClosing = true;
        let reason: WampusRouteCompletion;
        if (msg instanceof WampMessage.Abort) {
            return concat(this._closeRoutes$(new WampusRouteCompletion(WampusCompletionReason.RouterAbort, msg)), defer(async () => {
                await this.protocol.transport.close();
            }));
        }
        else {
            let echo$ = this.protocol.send$(factory.goodbye({
                message: "Goodbye received"
            }, WampUri.CloseReason.GoodbyeAndOut));

            let x = concat(echo$, this._closeRoutes$(new WampusRouteCompletion(WampusCompletionReason.RouterGoodbye, msg)), defer(async () => {
                await this.protocol.transport.close();
            }));
            return x;
        }
    }


    private _abort$(details: WampObject, reason: WampUriString) {
        let errorOnTimeout = timeoutWith(this.config.timeout, throwError(Errs.Leave.networkErrorOnAbort(new Error("Timed Out"))));
        let sending$ = this.protocol.send$(factory.abort(details, reason));
        let all$ = sending$.pipe(errorOnTimeout, catchError(() => {
            console.warn("Network error on ABORT.");
            return EMPTY;
        }));
        return concat(all$);
    }

    private _goodbye$(details: WampObject, reason: WampUriString) {
        let myGoodbye = factory.goodbye(details, reason);
        let sending$ = this.protocol.send$(myGoodbye);
        let expectingByeOrError$ = this.protocol.expectAny$(Routes.abort, Routes.goodbye);

        let failOnError = map((x: WM.Any) => {
            if (x instanceof WampMessage.Goodbye) {
                return x as WampMessage.Goodbye;
            }
        });

        return merge(sending$, concat(expectingByeOrError$).pipe(failOnError));
    }

    private _handshake$(authenticator: AuthenticationWorkflow): Observable<WM.Welcome> {
        let messenger = this.protocol;
        let config = this.config;
        let helloDetails = _.cloneDeep(wampusHelloDetails);
        if (config.helloDetails) {
            config.helloDetails(helloDetails);
        }
        let hello = factory.hello(config.realm, helloDetails);

        let handleAuthentication = flatMap((msg: WM.Any) => {
            if (msg instanceof WM.Challenge) {
                if (!authenticator) {
                    throw Errs.Handshake.noAuthenticator(msg);
                } else {
                    let simplifiedEvent = {
                        extra: msg.extra,
                        authMethod: msg.authMethod
                    } as ChallengeEvent;
                    return fromPromise(Promise.resolve(authenticator(simplifiedEvent))).pipe(flatMap(response => {
                        return this.protocol.send$(factory.authenticate(response.signature, response.extra));
                    }))
                }
            }
            return of(msg);
        });

        let handleWelcome = map((msg: WM.Any) => {
            if (msg instanceof WM.Abort) {
                switch (msg.reason) {
                    case WampUri.Error.NoSuchRealm:
                        throw Errs.Handshake.noSuchRealm(hello.realm, msg);
                    case WampUri.Error.ProtoViolation:
                        throw Errs.receivedProtocolViolation(hello, msg);
                    default:
                        throw Errs.Handshake.unrecognizedError(msg);
                }
            }
            if (!(msg instanceof WM.Welcome)) {
                throw Errs.Handshake.unexpectedMessage(msg);
            }
            return msg as WM.Welcome;
        });

        let sendHello$ = messenger.send$(hello);

        let welcomeMessage$ = merge(sendHello$, messenger.messages$.pipe(handleAuthentication, handleWelcome, take(1)));
        return welcomeMessage$.pipe(catchError(err => {
            if (err instanceof WampusRouteCompletion) {
                throw Errs.Handshake.closed();
            }
            throw err;
        }));
    }

    private _registerRoutes() {
        let catchCompletionError = catchError(err => {
            if (err instanceof WampusRouteCompletion) return EMPTY;
            throw err;
        });
        let serverInitiatedClose$ = this.protocol.expectAny$([WampType.ABORT], [WampType.GOODBYE]).pipe(take(1), flatMap((x: WM.Abort) => {
            return concat(this._handleClose$(x));
        }), catchCompletionError);

        let serverSentInvalidMessage$ = this.protocol.expectAny$(
            [WampType.WELCOME],
            [WampType.CHALLENGE]
        ).pipe(flatMap(x => {
            return this._abortDueToProtoViolation(`Received unexpected message of type ${WampType[x.type]}.`);
        }), catchCompletionError);

        let serverSentRouterMessage$ = this.protocol.expectAny$(
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