export interface PublisherFeatures {
    subscriber_blackwhite_listing: boolean;
    publisher_exclusion: boolean;
    publisher_identification: boolean;
    shareded_subscriptions: boolean;
}

export interface SubscriberFeatures {
    pattern_based_subscription: boolean;
    shareded_subscriptions: boolean;
    event_history: boolean;
    publisher_identification: boolean
    publication_trustlevels: boolean;
}

export interface CallerFeatures {
    progressive_call_results: boolean;
    call_timeout: boolean;
    call_cancelling: boolean;
    caller_identification: boolean;
    sharded_registration: boolean;
}

export interface CalleeFeatures {
    progressive_call_results: boolean;
    call_trustlevels: boolean;
    pattern_based_registration: boolean;
    shared_registration: boolean;
    call_timeout: boolean;
    call_cancelling: boolean;
    caller_identification: boolean;
    sharded_registration: boolean;
}

export interface HelloDetails {
    agent?: string;
    roles: {
        publisher?: {
            features?: Partial<PublisherFeatures>
        };
        subscriber?: {
            features?: Partial<SubscriberFeatures>
        };
        caller?: {
            features?: Partial<CallerFeatures>
        };
        callee?: {
            features?: Partial<CalleeFeatures>;
        };
    }
}

export interface WelcomeDetails {
    agent?: string;
    roles: {
        broker?: {
            features?: Partial<BrokerFeatures>;
        };
        dealer?: {
            features?: Partial<DealerFeatures>;
        }
    };
}

export interface DealerFeatures {
    registration_meta_api: boolean;
    shared_registration: boolean;
    session_meta_api: boolean;
    progressive_call_results: boolean;
    call_timeout: boolean;
    call_cancelling: boolean;
    caller_identification: boolean;
    call_trustlevels: boolean;
    pattern_based_registration: boolean;
    sharded_registration: boolean;

}

export interface BrokerFeatures {
    pattern_based_registration: boolean;
    shareded_subscriptions: boolean;
    event_history: boolean;
    session_meta_api: boolean;
    subscriber_blackwhite_listing: boolean;
    publisher_exclusion: boolean;
    publisher_identification: boolean;
    publication_trustlevels: boolean;
    pattern_based_subscription: boolean;
    sharded_subscription: boolean;
    subscription_meta_api : boolean;
}

export enum InvocationPolicy {
    Single = "single",
    RoundRobin = "roundrobin",
    Random = "random",
    First = "first",
    Last = "last"
}

export enum MatchType {
    Prefix = "prefix",
    Wildcard = "wildcard"
}

export interface WampPublishOptions {
    acknowledge?: boolean;
    exclude?: number[];
    exclude_authid?: string[];
    excluse_authrole?: string[];
    eligible?: number[];
    eligible_authid?: number[];
    eligible_authrole?: number[];
    // Defaults to true!
    exclude_me?: boolean;
}

export interface WampSubscribeOptions {
    match?: MatchType;
}

export interface WampRegisterOptions {
    disclose_caller?: boolean;
    match?: MatchType;
    invoke?: InvocationPolicy;
}

export interface WampYieldOptions {
    progress?: boolean;

}

export interface WampEventOptions {
    publisher?: number;
    trustlevel?: number;
    topic?: string;
}

export enum CancelMode {
    Skip = "skip",
    Kill = "kill",
    KillNoWait = "killnowait"
}

export interface WampCancelOptions {
    mode?: CancelMode;
}

export interface WampCallOptions {
    receive_progress?: boolean;
    disclose_me?: boolean;
    timeout?: number;
}

export interface WampResultOptions {
    progress?: boolean;
}

export interface WampInvocationOptions {
    receive_progress?: boolean;
    caller?: number;
    trustlevel?: number;
    procedure?: string;
}