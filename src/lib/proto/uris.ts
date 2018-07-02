export module WampUri {
    export enum Error {
        NotAuthorized = "wamp.error.not_authorized",
        ProcAlreadyExists = "wamp.error.procedure_already_exists",
        ProtoViolation = "wamp.error.protocol_violation",
        NoSuchRealm = "wamp.error.no_such_realm",
        NoSuchSubscription = "wamp.error.no_such_subscription",
        NoSuchRegistration = "wamp.error.no_such_registration",
        NoSuchProedure = "wamp.error.no_such_procedure",
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
    }

    export enum Close {
        GoodbyeAndOut = "wamp.close.goodbye_and_out",
        CloseRealm = "wamp.close.close_realm"
    }

    export enum Registration {
        OnRegister = "wamp.registration.on_register",
        OnUnregister = "wamp.registration.on_unregister",
        OnDelete = "wamp.registration.on_delete",
        List = "wamp.registration.list",
        Lookup = "wamp.registration.lookup",
        Match = "wamp.registration.match",
        Get = "wamp.registration.get",
        ListCallees = "wamp.registration.list_callees",
        CountCallees = "wamp.registration.count_callees",
    }

    export enum Reflection {
        ProcedureDescribe = "wamp.reflection.procedure.describe",
        ErrorDescribe = "wamp.reflection.error.describe",
        Describe = "wamp.reflect.describe",
        OnDefine = "wamp.reflect.on_define",
        OnUndefine = "wamp.reflect.on_undefine"
    }

    export enum Subscription {
        OnSubscribe = "wamp.subscription.on_subscribe",
        OnUnsubscribe = "wamp.subscription.on_unsubscribe",
        OnDelete = "wamp.subscription.on_delete",
        List = "wamp.subscription.list",
        Lookup = "wamp.subscription.lookup",
        Match = "wamp.subscription.match",
        Get = "wamp.subscription.get",
        ListSubscribers = "wamp.subscription.list_subscribers",
        CountSubscribers = "wamp.subscription.count_subscribers"
    }

    export enum Topic {
        HistoryLast = "wamp.topic.history.last",
        HistorySince = "wamp.topic.history.since",
        HistoryAfter = "wamp.topic.history.after"
    }

    export enum Session {
        FlushTestaments = "wamp.session.flush_testaments",
        OnJoin = "wamp.session.on_join",
        OnLeave = "wamp.session.on_leave",
        Count = "wamp.session.count",
        List = "wamp.session.list",
        Get = "wamp.session.get"
    }
}