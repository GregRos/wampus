/**
 * @module core
 */
import {WampMessage, WampObject, WampUriString} from "../protocol/messages";
import {WampType} from "../protocol/message.type";
import {Errs} from "../errors/errors";
import {AdvProfile, WampUri} from "../protocol/uris";
import {WampusNetworkError} from "../errors/types";
import {Routes} from "../routing/routes";
import {CancelMode, HelloDetails, InvocationPolicy, WampSubscribeOptions, WelcomeDetails} from "../protocol/options";
import {WampProtocolClient} from "../routing/wamp-protocol-client";
import {
	CallResultData,
	CallTicket,
	CancellationToken,
	EventData,
	InvocationTicket,
	RegistrationTicket,
	SubscriptionTicket
} from "./ticket";
import {
	concat,
	defer,
	EMPTY,
	merge,
	NEVER,
	Observable,
	of,
	onErrorResumeNext,
	race,
	Subject,
	throwError,
	timer
} from "rxjs";
import {
	catchError,
	flatMap,
	map,
	mapTo,
	mergeMapTo,
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
} from "./message-arguments";
import {MyPromise} from "../../utils/ext-promise";
import {publishAutoConnect, publishReplayAutoConnect, skipAfter} from "../../utils/rxjs-operators";
import {TransportFactory} from "../transport/transport";
import {wampusHelloDetails} from "../hello-details";
import {MessageReader} from "../protocol/reader";
import {DefaultMessageFactory} from "./default-factory";
import {AuthenticatorFunction, ChallengeEvent} from "./authentication";
import {fromPromise} from "rxjs/internal-compatibility";
import {WampusCompletionReason, WampusRouteCompletion} from "./route-completion";

export interface CoreSessionConfig {
	realm: string;
	timeout: number;
	transport: TransportFactory;
	authenticator?: AuthenticatorFunction;
	helloDetails?(defaults: HelloDetails): void;
}

import _ = require("lodash");
import WM = WampMessage;

let factory = DefaultMessageFactory;


/**
 * The Wampus class that implements most WAMP session logic.
 * This class is usually used via a wrapper session that enriches the session object's functionality.
 */
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

	static async create(config: CoreSessionConfig): Promise<WampusCoreSession> {
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
			session._registerControlRoutes().subscribe();
		}));
		return concat(getSessionFromShake$).pipe(mapTo(session), take(1)).toPromise();
	}

	/**
	 * Registers a procedure and returns a registration ticket.
	 * @param wArgs The arguments for registering the procedure, including the function that is invoked when the procedure is called.
	 * @returns A promise that resolves with the ticket once the registration is successful.
	 */
	async register(wArgs: WampusRegisterArguments): Promise<RegistrationTicket> {
		let {options, name} = wArgs;
		let msg = factory.register(options, name);

		let self = this;
		if (!this.isActive) throw Errs.sessionClosed(msg);

		options = options || {};

		let {_welcomeDetails} = this;
		let features = _welcomeDetails.roles.dealer.features;
		// Make sure the router's WELCOME message supports all the features specified in options and throw an error otherwise.
		if (options.disclose_caller && !features.caller_identification) {
			throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Call.CallerIdentification);
		}
		if (options.match && !features.pattern_based_registration) {
			throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Call.PatternRegistration);
		}
		if (options.invoke && options.invoke !== InvocationPolicy.Single && !features.shared_registration) {
			throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Call.SharedRegistration);
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
				let interruptRequest$ = this.protocol.expectAny$([WampType.INTERRUPT, invocationMsg.requestId])
					.pipe(map(x => x as WM.Interrupt), map(x => {
						return {
							received: new Date(),
							options: x.options,
							source: procInvocationTicket,
							type : "cancel"
						} as CancellationToken;
					}));

				// Fabricate a cancellation token if the timeout is elapsed.
				let timeout = invocationMsg.options.timeout >= 0 ? timer(invocationMsg.options.timeout) : NEVER;
				let timeoutEvent$ = timeout.pipe(map(x => {
					return {
						received : new Date(),
						options : {},
						source : procInvocationTicket,
						type : "timeout"
					} as CancellationToken
				}));

				let anyInterrupt$ = merge(interruptRequest$, timeoutEvent$);
				let expectInterrupt =
					anyInterrupt$
						.pipe(take(1), takeUntil(completeInterrupt), catchError(err => {
							if (err instanceof WampusRouteCompletion) {
								return EMPTY;
							}
							throw err;
						}), publishReplayAutoConnect());
				let isHandled = false;

				// Send the selected WAMP message as a reply to the invocation
				let send$ = (msg: WampMessage.Any) => {
					if (!this.isActive) return throwError(Errs.sessionIsClosing(msg));

					// If the message is progress, make sure this invocation supports progress
					if (msg instanceof WampMessage.Yield && msg.options.progress) {
						if (!invocationMsg.options.receive_progress) {
							return throwError(Errs.Register.doesNotSupportProgressReports(name));
						}
					}
					// Make sure the user can't send a response twice.
					if (isHandled) {
						return throwError(Errs.Register.cannotSendResultTwice(name));
					}
					// If this response finishes the invocation, close the route waiting for an INTERRUPT
					// and mark handled.
					if (msg instanceof WampMessage.Error || msg instanceof WampMessage.Yield && !msg.options.progress) {
						completeInterrupt.next();
						isHandled = true
					}
					return this.protocol.send$(msg);
				};

				// Create an invocation ticket.
				let procInvocationTicket: InvocationTicket = {
					source: procRegistrationTicket,
					error(err: WampusSendErrorArguments) {
						if (typeof err !== "object") {
							throw Errs.Register.resultIncorrectFormat(name, err);
						}
						let {args, error, kwargs, details} = err;
						return send$(factory.error(WampType.INVOCATION, invocationMsg.requestId, details, error, args, kwargs)).toPromise();
					},
					return(obj: WampusSendResultArguments) {
						if (typeof obj !== "object") {
							throw Errs.Register.resultIncorrectFormat(name, obj);
						}
						let {args, kwargs, options} = obj;
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

			// Bind the case when an invocation is received to the expectation for the INVOCATION message.
			let invocations$ = expectInvocation$.pipe(whenInvocationReceived);

			// Create the registration ticket
			let procRegistrationTicket: RegistrationTicket = {
				invocations: invocations$.pipe(publishAutoConnect()),
				close() {
					if (closing) return closing;
					closing = close();
					return closing;
				},
				info: {
					name,
					options,
					registrationId: registered.registrationId
				},
				get isOpen() {
					return !closing && !self._isClosing;
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

	/**
	 * Publish an event to a topic.
	 * @param wArgs All the arguments required
	 */
	async publish(wArgs: WampusPublishArguments): Promise<void> {
		let {options, args, kwargs, name} = wArgs;
		let msg = factory.publish(options, name, args, kwargs);
		if (!this.isActive) throw Errs.sessionClosed(msg);

		options = options || {};
		let features = this._welcomeDetails.roles.broker.features;

		// Make sure the event's options are supported by the broker
		if ((options.eligible || options.eligible_authid || options.eligible_authrole
			|| options.exclude || options.exclude_authid || options.exclude_authrole) && !features.subscriber_blackwhite_listing) {
			throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Subscribe.SubscriberBlackWhiteListing);
		}
		if (options.disclose_me && !features.publisher_identification) {
			throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Subscribe.PublisherIdentification);
		}
		if (options.exclude_me === false && !features.publisher_exclusion) {
			throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Subscribe.PublisherExclusion);
		}
		return defer(() => {
			let expectAcknowledge$: Observable<any>;
			// If acknowledgement is enabled, we need to wait for a message...
			if (options.acknowledge) {
				// Create a route for PUBLISHED | ERROR, PUBLISH
				let expectPublishedOrError$ = this.protocol.expectAny$(
					Routes.published(msg.requestId),
					Routes.error(WampType.PUBLISH, msg.requestId)
				).pipe(take(1), catchError(err => {
					if (err instanceof WampusRouteCompletion) {
						// If the route is completed, throw an error (the event could not be published).
						throw Errs.sessionIsClosing(msg);
					}
					throw err;
				}));
				// If an error is received, handle it.
				let failOnError = map((response: WM.Any) => {
					if (response instanceof WM.Error) {
						this._throwCommonError(msg, response);
						throw Errs.Publish.unknown(msg.topic, response);
					}
					return response;
				});
				expectAcknowledge$ = expectPublishedOrError$.pipe(failOnError, mergeMapTo(EMPTY));
			} else {
				// If acknowledgelement is not enabled, use EMPTY.
				expectAcknowledge$ = EMPTY;
			}
			// Send the PUBLISH message
			let sendingPublish$ = this.protocol.send$(msg);

			if (!options.acknowledge) {
				// If acknowledgement is disabled, swallow any errors fom a failed send$ call
				sendingPublish$ = sendingPublish$.pipe(catchError(err => {
					return EMPTY;
				}))
			}

			// Send the PUBLISH message and set up the route for expecting acknowledgement at the same time
			// to maintain uniformity
			return merge(sendingPublish$, expectAcknowledge$);
		}).toPromise();
	}

	/**
	 * Subscribes to a topic and returns a subscription ticket that exposes an observable which will fire every time the subscription is triggered.
	 * @param {WampSubscribeOptions} wArgs All the info necessary to subscribe to a topic.
	 * @returns A promise that resolves with the subscription ticket when the subscription has been established.
	 */
	async topic(wArgs: WampusSubcribeArguments): Promise<SubscriptionTicket> {
		let {options, name} = wArgs;
		let msg = factory.subscribe(options, name);
		let self = this;
		if (!this.isActive) throw Errs.sessionClosed(msg);

		options = options || {};

		// Make sure the session supports the subscription features.
		let features = this._welcomeDetails.roles.broker.features;
		if (options.match && !features.pattern_based_subscription) {
			throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Subscribe.PatternBasedSubscription);
		}

		let expectSubscribedOrError$ = defer(() => {
			let sending$ = this.protocol.send$(msg);
			// Creates a expectation for the SUBSCRIBED message

			let expectSubscribedOrError$ = this.protocol.expectAny$(
				Routes.subscribed(msg.requestId),
				Routes.error(WampType.SUBSCRIBE, msg.requestId)
			);

			// Throw an error if an ERROR message is received
			let failOnErrorOrCastToSubscribed = map((x: WM.Any) => {
				if (x instanceof WM.Error) {
					// No SUBSCRIBE-specific errors spring to mind
					this._throwCommonError(msg, x);
					throw Errs.Subscribe.other(name, x);
				}
				return x as WM.Subscribed;
			});
			// Send the SUBSCRIBE message and set up the route for the reply at the same time
			return merge(sending$, expectSubscribedOrError$).pipe(failOnErrorOrCastToSubscribed);
		}).pipe(catchError(err => {
			// If the route is being forced closed, throw an error.
			if (err instanceof WampusRouteCompletion) {
				throw Errs.sessionIsClosing(msg);
			}
			throw err;
		}));

		// Once SUBSCRIBED is received, create a ticket for the subscription.
		let whenSubscribedCreateTicket = map((subscribed: WM.Subscribed) => {
			let unsub = factory.unsubscribe(subscribed.subscriptionId);

			// Create route for EVENT messages.
			let expectEvents$ = this.protocol.expectAny$(Routes.event(subscribed.subscriptionId)).pipe(catchError(err => {
				// If the route is forced closed, just pretend the subscription has been closed.
				if (err instanceof WampusRouteCompletion) {
					closing = Promise.resolve();
					return EMPTY;
				}
				throw err;
			}));
			let closeSignal = new Subject();
			let closing: Promise<any>;

			// This is called when the subscription is closed.
			let close = async () => {
				// If the session is closing, ignore this.
				if (this._isClosing) return;

				// Create route for UNSUBSCRIBED or ERROR, UNSUBSCRIBE
				let expectUnsubscribedOrError$ = this.protocol.expectAny$(
					Routes.unsubscribed(unsub.requestId),
					Routes.error(WampType.UNSUBSCRIBE, unsub.requestId)
				);

				// Handle errors, if any
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
				// Actually send the UNSUBSCRIBE message and set up the route for the repy.
				let total = merge(sendUnsub$, expectUnsubscribedOrError$).pipe(failOnUnsubscribedError, take(1), catchError(err => {
					// If a route is forced closed, just pretend we've received a reply.
					if (err instanceof WampusRouteCompletion) {
						return EMPTY;
					}
					throw err;
				}));
				return total.toPromise();
			};

			// Map EVENT messages to objects.
			let mapToLibraryEvent = map((x: WM.Event) => {
				let a: EventData = {
					args: x.args,
					details: x.details,
					kwargs: x.kwargs,
					source: eventSubscriptionTicket
				};
				return a;
			});

			// Create the subscription ticket.
			let eventSubscriptionTicket = {
				close() {
					if (closing) return closing;
					closing = close();
					return closing;
				},
				// Here we map the EVENT messages to objects
				events: expectEvents$.pipe(mapToLibraryEvent).pipe(takeUntil(closeSignal), publishAutoConnect()),
				info: {
					subscriptionId: subscribed.subscriptionId,
					name: name,
					options: options
				},
				get isOpen() {
					return !closing && !self._isClosing;
				}
			} as SubscriptionTicket;
			return eventSubscriptionTicket;
		});

		return expectSubscribedOrError$.pipe(take(1), whenSubscribedCreateTicket).toPromise();
	}

	/**
	 * Calls a WAMP procedure
	 * @param wArgs All the arguments required to call a procedure.
	 */
	call(wArgs: WampusCallArguments): CallTicket {
		try {
			let {options, name, args, kwargs} = wArgs;
			let features = this._welcomeDetails.roles.dealer.features;

			// Wampus calls support progress by default
			options = _.defaults(options, {
				receive_progress: features.progressive_call_results
			});
			let msg = factory.call(options, name, args, kwargs);

			// If the session is closed, end here.
			if (!this.isActive) throw Errs.sessionClosed(msg);
			let self = this;
			let canceling: Promise<any>;

			// Check call options are compatible with the deaqler's features.
			if (options.disclose_me && !features.caller_identification) {
				throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Call.CallerIdentification);
			}
			if (options.receive_progress && !features.progressive_call_results) {
				throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Call.ProgressReports);
			}
			if (options.timeout && !features.call_timeout) {
				throw Errs.routerDoesNotSupportFeature(msg, AdvProfile.Call.CallTimeouts);
			}

			// Check if this message will finish the call to mark it as non-cancellable.
			let maybeTooLateToCancel = tap((x : WM.Any) => {
				if (x instanceof WM.Error || x instanceof WM.Result && !x.details.progress) {
					canceling = Promise.resolve();
				}
			});

			// Handle an error or continue
			let failOnError = map((x: WM.Any) => {
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

			// Map a RESULT message to an object.
			let toLibraryResult = map((x: WM.Result) => {
				return {
					args: x.args,
					kwargs: x.kwargs,
					isProgress: x.details.progress || false,
					details: x.details,
					name: name,
					source: callTicket
				} as CallResultData;
			});

			// Set up the route for (RESULT | ERROR, CALL)
			// And pass it through the operators defined above
			let expectResultOrError = self.protocol.expectAny$(
				Routes.result(msg.requestId),
				Routes.error(WampType.CALL, msg.requestId)
			).pipe(maybeTooLateToCancel, catchError(err => {
				if (err instanceof WampusRouteCompletion) {
					// If the route is being closed, throw an error to indicate calling failed
					throw Errs.sessionIsClosing(msg);
				}
				throw err;
			}), failOnError, toLibraryResult).pipe(publishAutoConnect());

			// Send the CALL message and cache the result. We'll need to refer to this observable in the future.
			let sending = this.protocol.send$(msg).pipe(publishAutoConnect());

			// Merge sending and creating the route for the reply, and set up the conditions for non-error call completion.
			let allStream =
				merge(expectResultOrError, sending)
					.pipe(skipAfter((x: CallResultData) => !x.isProgress));

			// Start the cancelling flow
			let startCancelling = (cancel: WM.Cancel) => defer(async () => {
				if (this._isClosing) return;
				let sendCancel$ = this.protocol.send$(cancel);

				// Send the CANCEL message
				// And also create a route for (RESULT | ERROR, CALL)
				return merge(sendCancel$, self.protocol.expectAny$(
					Routes.result(msg.requestId),
					Routes.error(WampType.CALL, msg.requestId)
				).pipe(skipAfter(x => {
					// If canelling is successful, the route will yield ERROR, CALL so this will be used both in the regular flow
					// and also as a response to the CANCEL message.
					// If cancelling comes too late, the route will yield a non-progress RESULT, which will also be a response to the CANCEL message.
					return x instanceof WM.Result && !x.details.progress || x instanceof WM.Error;
				}), catchError(err => {
					// If the route is forced closed, stop the cancelling flow and assume it finished.
					if (err instanceof WampusRouteCompletion) {
						return EMPTY;
					}
					throw err;
				}), map(msg => {
					// Swallow any result
				}))).toPromise();
			});
			// Record all messages
			let progressStream = allStream.pipe(publishAutoConnect());

			// Create a call ticket
			let callTicket: CallTicket = {
				progress: progressStream,
				close(mode ?: CancelMode) {
					// Here we'll begin the cancelling flow
					let cancel = factory.cancel(msg.requestId, {
						mode: mode || CancelMode.Kill
					});
					// First we need to make sure cancelling is supported
					if (!features.call_canceling) {
						return Promise.reject(Errs.routerDoesNotSupportFeature(cancel, AdvProfile.Call.CallCancelling));
					}
					// If cancelling is already being performed, just return the existing promise.
					if (canceling) return canceling;

					// Otherwise, assign the promise to a cancelling flow.
					return canceling = concat(sending, startCancelling(cancel)).toPromise().then(() => {
					});
				},
				get isOpen() {
					return !canceling && !self._isClosing;
				},
				info: {
					callId: msg.requestId,
					name,
					options
				}
			};

			return callTicket;
		}
		catch (err) {
			// We want to deal uniformally with errors thrown by the called code directly
			// And errors encountered in the async observable flow. That's why we turn a sync error here
			// into an async one.
			return {
				async close() {

				},
				progress: throwError(err),
				get isOpen() {
					return false;
				},
				info: {
					...wArgs,
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
		// If we're already closing, return an EMPTY
		if (this._isClosing) return EMPTY;
		// Mark _isClosing ourselves
		this._isClosing = true;
		// If told to close using ABORT
		if (abrupt) {
			// We do these steps in sequence. First we force close all routes, and then we send an ABORT signal.
			// We do that because sending ABORT will end up in the transport being closed, and we want to handle
			// Forcing the routes closed correctly ourselves to avoid issues.

			// Finally, we terminate the connection ourselves
			return concat(
				this._closeRoutes$(new WampusRouteCompletion(WampusCompletionReason.SelfAbort)),
				this._abort$(details, reason),
				defer(async () => {
					return this.protocol.transport.close();
				})
			);
		}

		// Here we deal with GOODBYE-type termination.
		// We set a timeout for the GOODBYE response to arrive.
		let timeout = timer(this.config.timeout).pipe(flatMap(() => {
			throw Errs.Leave.goodbyeTimedOut();
		}));

		// We take the first: GOODBYE or timeout.
		let expectGoodbyeOrTimeout = race(this._goodbye$(details, reason), timeout).pipe(catchError(err => {
			// If the transport is closed before the _goodbye$ workflow is finished, just stop.
			if (err instanceof WampusNetworkError) {
				return EMPTY;
			}
			// TODO: Handle this without console.warn
			console.warn("Error when saying GOODBYE. Going to say ABORT.", err);
			// Going to ABORT since GOODBYE failed.
			return this._abort$(details, reason);
		}), take(1));

		// The same as in the timing for abrupt termination
		// We first close the routes and only then begin the GOODBYE sequence
		// This is also true because routes defined earlier are set up to receive GOODBYE to detect a server-initiated polite termination
		// And if we didn't close the routes here, it would get confused.
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
		// TODO: Rework the timing of this code
		// Note that the timing here is really fragile, because we might end up doing something like:
		// expectRoute$(x).flatMap(x => _closeRoutes$())
		// Which basically means that as part of the inner obervable returned by flatMap, the outer observable `expectRoute$(x)` is going to error
		// So a sequence of timeouts is used that may not be portable or even a good idea.
		return defer(async () => {
			this.protocol.invalidateAllRoutes(err);
			// We give the routes time to close before continuing
			await MyPromise.wait(0);
		}).pipe(take(1));
	}


	private _handleClose$(msg: WampMessage.Goodbye | WampMessage.Abort) {
		// This code is for handling server-initiated closing.
		if (this._isClosing) return EMPTY;
		this._isClosing = true;


		if (msg instanceof WampMessage.Abort) {
			// The closing is abrupt. The server doesn't want any reply and may terminate the connection immediately.
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

	private _handshake$(authenticator: AuthenticatorFunction): Observable<WM.Welcome> {
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

	private _registerControlRoutes() {
		let catchCompletionError = catchError(err => {
			// These routes can be completed without any issue.
			if (err instanceof WampusRouteCompletion) return EMPTY;
			throw err;
		});

		// Here we detect server-initiated closing of the session.
		let serverInitiatedClose$ = this.protocol.expectAny$([WampType.ABORT], [WampType.GOODBYE]).pipe(take(1), flatMap((x: WM.Abort) => {
			return concat(this._handleClose$(x));
		}), catchCompletionError);

		// Now we define a few protocol violations that can be committed by the router.
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