import {WampMsgType} from "./message.type";

export type WampRawMessage = any[];

export interface PublisherFeatures {
    subscriber_blackwhite_listing : boolean;
    publisher_exclusion : boolean;
    publisher_identification : boolean;
    shareded_subscriptions : boolean;
}

export interface SubscriberFeatures {
    pattern_based_subscription : boolean;
    shareded_subscriptions : boolean;
    event_history : boolean;
    publisher_identification : boolean
    publication_trustlevels : boolean;
}

export interface CallerFeatures {
    progressive_call_results : boolean;
    call_timeout : boolean;
    call_cancelling : boolean;
    caller_identification : boolean;
    sharded_registration : boolean;
}

export interface CalleeFeatures {
    progressive_call_results : boolean;
    call_trustlevels : boolean;
    pattern_based_registration : boolean;
    shared_registration : boolean;
    call_timeout : boolean;
    call_cancelling : boolean;
    caller_identification : boolean;
    sharded_registration : boolean;
}



export interface HelloDetails {
    agent ?: string;
    roles : {
        publisher ?: {
            features ?: Partial<PublisherFeatures>
        };
        subscriber ?: {
            features ?: Partial<SubscriberFeatures>
        };
        caller ?: {
            features ?: Partial<CallerFeatures>
        };
        callee ?: {
            features ?: Partial<CalleeFeatures>;
        };
    }
}

export interface WelcomeDetails {
    agent ?: string;
    roles : {
        broker ?: {
            features ?: Partial<BrokerFeatures>;
        };
        dealer ?: {
            features ?: Partial<DealerFeatures>;
        }
    };
}

export interface DealerFeatures {
    registration_meta_api : boolean;
    shared_registration : boolean;
    session_meta_api : boolean;
    progressive_call_results : boolean;
    call_timeout : boolean;
    call_cancelling : boolean;
    caller_identification : boolean;
    call_trustlevels : boolean;
    pattern_based_registration : boolean;
    sharded_registration : boolean;

}

export interface BrokerFeatures {
    pattern_based_registration : boolean;
    shareded_subscriptions : boolean;
    event_history : boolean;
    session_meta_api : boolean;
    subscriber_blackwhite_listing : boolean;
    publisher_exclusion : boolean;
    publisher_identification : boolean;
    publication_trustlevels : boolean;
    pattern_based_subscription : boolean;
    sharded_subscription : boolean;
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
    acknowledge ?: boolean;
    exclude ?: number[];
    exclude_authid ?: string[];
    excluse_authrole ?: string[];
    eligible ?: number[];
    eligible_authid ?: number[];
    eligible_authrole ?: number[];
    // Defaults to true!
    exclude_me ?: boolean;
}

export interface WampSubscribeOptions {
    match ?: MatchType;
}

export interface WampRegisterOptions {
    disclose_caller ?: boolean;
    match ?: MatchType;
    invoke ?: InvocationPolicy;
}

export interface WampYieldOptions {
    progress ?: boolean;

}

export interface WampEventOptions {
    publisher ?: number;
    trustlevel ?: number;
    topic ?: string;
}

export enum CancelMode {
    Skip = "skip",
    Kill = "kill",
    KillNoWait = "killnowait"
}

export interface WampCancelOptions {
    mode ?: CancelMode;
}

export interface WampCallOptions {
    receive_progress ?: boolean;
    disclose_me ?: boolean;
    timeout ?: number;
}


export interface WampResultOptions {
    progress ?: boolean;
}

export interface WampInvocationOptions {
    receive_progress ?: boolean;
    caller ?: number;
    trustlevel ?: number;
    procedure ?: string;
}


export interface WampMessage {
     type : WampMsgType;
}

function argsKwargsArray(args : any[], kwargs : any) {
    let hasKwargs = kwargs && Object.keys(kwargs).length > 0;
    let hasArgs = args && args.length > 0;
    if (!hasArgs && !hasKwargs) {
        return [];
    } else if (!hasArgs && hasKwargs) {
        return [[], kwargs];
    } else if (hasArgs && !hasKwargs) {
        return [args];
    } else {
        return [args, kwargs];
    }
}



export module DSFF{
    export interface Call {
        type : WampMsgType.Call;
    }
}

export module WampMessage {
    export class Call implements WampMessage{
        type = WampMsgType.Call;
        constructor(public requestId : number, public options : WampCallOptions, public procedure : string, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            let {args,kwargs} = this;
            return [this.type, this.requestId, this.options || {}, ...argsKwargsArray(args, kwargs)];
        }
    }

    export class Error implements WampMessage {
        type = WampMsgType.Error;
        constructor(public errSourceType : WampMsgType, public errSourceId : number, public details : any, public error : string, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            return [this.type, this.errSourceType, this.errSourceId, this.details, this.error];
        }
    }

    export class Hello implements WampMessage {
        type = WampMsgType.Hello;
        constructor(public realm : string, public details : HelloDetails) {

        }

        toTransportFormat() {
            return [this.type, this.realm, this.details];
        }
    }

    export class Abort implements WampMessage {
        type = WampMsgType.Abort;
        constructor(public details : Record<string, any>, public reason : string) {

        }

        toTransportFormat() {
            return [this.type, this.details, this.reason];
        }
    }

    export class Goodbye implements WampMessage {
        type = WampMsgType.Goodbye;
        constructor(public details : Record<string, any>, public reason : string) {

        }

        toTransportFormat() {
            return [this.type, this.details, this.reason];
        }
    }

    export class Publish implements WampMessage {
        type = WampMsgType.Publish;
        constructor(public requestId : number, public options : WampPublishOptions, public topic : string, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.topic, ...argsKwargsArray(this.args, this.kwargs)];
        }
    }

    export class Subscribe implements WampMessage {
        type = WampMsgType.Subscribe;
        constructor(public requestId : number, public options : WampSubscribeOptions, public topic : string) {

        }
        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.topic];
        }
    }

    export class Unsubscribe implements WampMessage {
        type = WampMsgType.Unsubscribe;
        constructor(public requestId : number, public subscription : number) {

        }
        toTransportFormat() {
            return [this.type, this.requestId, this.subscription];
        }
    }

    export class Register  {
        type = WampMsgType.Register;

        constructor(public requestId : number, public options : WampRegisterOptions, public procedure : string) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.procedure];
        }
    }

    export class Unknown {
        type = WampMsgType._Unknown;
        constructor(public raw : any[]) {

        }
    }

    export class Unregister  {
        type = WampMsgType.Unregister;

        constructor(public requestId : number, public registration : number) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.registration];
        }
    }

    export class Yield implements WampMessage {
        type = WampMsgType.Yield;

        constructor(public invocationId : number, public options : WampYieldOptions, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            return [this.type, this.invocationId, this.options, ...argsKwargsArray(this.args, this.kwargs)];
        }
    }

    export class Welcome implements WampMessage {
        type = WampMsgType.Welcome;

        constructor(public sessionId : number, public details : WelcomeDetails) {

        }
    }

    export class Published implements WampMessage {
        type = WampMsgType.Published;

        constructor(public publishReqId : number, public publicationId : number) {

        }
    }

    export class Subscribed implements WampMessage {
        type = WampMsgType.Subscribed;

        constructor(public subscribeReqId : number, public subscriptionId : number) {

        }
    }

    export class Unsubscribed implements WampMessage {
        type = WampMsgType.Unsubscribed;

        constructor(public threadId : number) {

        }
    }

    export class Event implements WampMessage {
        type = WampMsgType.Event;

        constructor(public subscriptionId : number, public publicationId : number, public details : WampEventOptions, public args ?: any[], public kwargs ?: any) {
            this.args = this.args || [];
            this.kwargs = this.kwargs || {};
        }
    }

    export class Result implements WampMessage {
        type = WampMsgType.Result;

        constructor(public callReqId : number, public details : WampResultOptions, public args ?: any[], public kwargs ?: any) {

        }
    }

    export class Registered implements WampMessage {
        type = WampMsgType.Registered;

        constructor(public threadId : number, public registrationId : number) {

        }
    }

    export class Unregistered implements WampMessage {
        type = WampMsgType.Unregistered;

        constructor(public unregisterReqId : number) {

        }
    }

    export class Invocation implements WampMessage{
        type = WampMsgType.Invocation;

        constructor(public requestId : number, public registrationId : number, public options : WampInvocationOptions, public args ?: any[], public kwargs ?: any) {

        }
    }

    export class Challenge implements WampMessage {
        type = WampMsgType.Challenge;

        constructor(public authMethod : string, public extra : object) {

        }
    }

    export class Cancel implements WampMessage {
        type = WampMsgType.Cancel;

        constructor(public callRequestId : number, public options : object) {

        }

        toTransportFormat() {
            return [this.type, this.callRequestId, this.options];
        }
    }

    export class Interrupt implements WampMessage {
        type = WampMsgType.Interrupt;

        constructor(public callRequestId : number, public options : object) {

        }
    }

    export class Authenticate implements WampMessage {
        type = WampMsgType.Authenticate;

        constructor(public signature : string, public extra : object) {

        }

        toTransportFormat() {
            return [this.type, this.signature, this.extra];
        }
    }


    export type Any = Cancel | Unknown | Interrupt | Authenticate | Challenge | Hello | Welcome | Abort | Goodbye | Error | Publish | Published | Subscribe | Subscribed | Unsubscribe | Unsubscribed | Event | Call | Result | Register | Registered | Unregister | Unregistered | Invocation | Yield;

    export type SendableMessage = Any & {toTransportFormat() : any[]};


}

