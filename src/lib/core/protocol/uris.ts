/**
 * Set of URIs mentioned by the WAMP protocol.
 */
export module WampUri {
    /**
     * Standard error URIs.
     */
    export enum Error {
        Prefix = "wamp.error",
        NotAuthorized = "wamp.error.not_authorized",
        ProcAlreadyExists = "wamp.error.procedure_already_exists",
        ProtoViolation = "wamp.error.protocol_violation",
        NoSuchRealm = "wamp.error.no_such_realm",
        NoSuchSubscription = "wamp.error.no_such_subscription",
        NoSuchRegistration = "wamp.error.no_such_registration",
        NoSuchProcedure = "wamp.error.no_such_procedure",
        InvalidUri = "wamp.error.invalid_uri",
        InvalidArgument = "wamp.error.invalid_argument",
        AuthFailed = "wamp.error.authorization_failed",
        NoSuchRole = "wamp.error.no_such_role",
        NoSuchSession = "wamp.error.no_such_session",
        // Advanced Profile
        Canceled = "wamp.error.canceled",
        OptionNotAllowed = "wamp.error.option_not_allowed",
        NoEligibleCallee = "wamp.error.no_eligible_callee",
        DisallowedDiscloseMe = "wamp.error.option_disallowed.disclose_me",
        NetworkFailure = "wamp.error.network_failure",
        RuntimeError = "wamp.error.runtime_error"
    }

    /**
     * Standard reasons for closing a session.
     */
    export enum CloseReason {
        GoodbyeAndOut = "wamp.close.goodbye_and_out",
        CloseRealm = "wamp.close.close_realm"
    }

    export module MetaApi {
        export module Registration {
            export enum Event {
                OnRegister = "wamp.registration.on_register",
                OnUnregister = "wamp.registration.on_unregister",
                OnRegistrationDelete = "wamp.registration.on_delete",
            }

            export enum Procedure {
                List = "wamp.registration.list",
                Lookup = "wamp.registration.lookup",
                Match = "wamp.registration.match",
                Get = "wamp.registration.get",
                ListCallees = "wamp.registration.list_callees",
                CountCallees = "wamp.registration.count_callees",
            }
        }
        export module Subscription {
            export enum Procedure {
                List = "wamp.subscription.list",
                Lookup = "wamp.subscription.lookup",
                Match = "wamp.subscription.match",
                Get = "wamp.subscription.get",
                ListSubscribers = "wamp.subscription.list_subscribers",
                CountSubscribers = "wamp.subscription.count_subscribers"
            }

            export enum Event {
                OnSubscribe = "wamp.subscription.on_subscribe",
                OnUnsubscribe = "wamp.subscription.on_unsubscribe",
                OnSubscriptionDelete = "wamp.subscription.on_delete",
            }
        }

        export module History {
            export enum Procedures {
                Last = "wamp.topic.history.last",
                Since = "wamp.topic.history.since",
                After = "wamp.topic.history.after"
            }
        }
        export module Session {
            export enum Events {
                OnJoin = "wamp.session.on_join",
                OnLeave = "wamp.session.on_leave",
            }

            export enum Procedures {
                Count = "wamp.session.count",
                List = "wamp.session.list",
                Get = "wamp.session.get",
                FlushTestaments = "wamp.session.flush_testaments",
            }
        }
    }
}

export module AdvProfile {
    export module Call {
        export const ProgressReports = "ProgressiveCallResults";
        export const CallTimeouts = "CallTimeout";
        export const CallCancelling = "CallCancelling";
        export const CallerIdentification = "CallerIdentification";
        export const CallTrustLevels = "CallTrustLevels";
        export const PatternRegistration = "PatternBasedRegistration";
        export const SharedRegistration = "SharedRegistration";
    }

    export module Subscribe {
        export const SubscriberBlackWhiteListing = "SubscriberBlackWhiteListing";
        export const PublisherIdentification = "PublisherIdentification";
        export const PublisherExclusion = "PublisherExclusion";
        export const PatternBasedSubscription = "PatternBasedSubscription";
    }
}