import {WampType} from "./message.type";
import {
    HelloDetails,
    WampCallOptions, WampCancelOptions,
    WampEventOptions,
    WampInvocationOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampResultOptions,
    WampSubscribeOptions,
    WampYieldOptions,
    WelcomeDetails
} from "./options";

export type WampId = number;
export type WampUriString = string;
export type WampPrimitive = string | number | boolean | WampId | WampUriString;

export type WampObject = any;

export type WampArray = any[];
export type WampRawMessage = WampArray;

export interface WampMessage {
     type : WampType;
}

export enum WampusCompletionReason {
    SelfGoodbye = "SelfPoliteTermination",
    RouterGoodbye = "RouterPoliteTermination",
    SelfAbort = "SelfAbort",
    RouterAbort = "RouterAbort",
    RouterDisconnect = "RouterDisconnect"
}


export class WampusRouteCompletion extends Error {

    constructor(public reason : WampusCompletionReason, public msg ?: WampMessage.Any) {
        super("Route completed");
    }

    toTransportFormat() {
        throw new global.Error("This message is used internally and cannot be transmitted.");
    }
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

/**
 * Namespace for all WAMP protocol message objects.
 */
export module WampMessage {
    /**
     * A class representing the CALL message.
     */
    export class Call implements WampMessage{
        type = WampType.CALL;
        constructor(public requestId : WampId, public options : WampCallOptions, public procedure : WampUriString, public args ?: WampArray, public kwargs ?: WampObject) {
        }

        toTransportFormat() {
            let {args,kwargs} = this;
            return [this.type, this.requestId, this.options || {}, this.procedure, ...argsKwargsArray(args, kwargs)];
        }
    }

    /**
     * A class representing the ERROR message.
     */
    export class Error implements WampMessage {
        type = WampType.ERROR;
        constructor(public errSourceType : WampType, public errSourceId : WampId, public details : WampObject, public error : WampUriString, public args ?: WampArray, public kwargs ?: WampObject) {

        }

        toTransportFormat() {
            return [this.type, this.errSourceType, this.errSourceId, this.details, this.error, this.args, this.kwargs];
        }
    }

    /**
     * A class representing the HELLO message.
     */
    export class Hello implements WampMessage {
        type = WampType.HELLO;
        constructor(public realm : string, public details : HelloDetails) {

        }

        toTransportFormat() {
            return [this.type, this.realm, this.details];
        }
    }

    /**
     * A class representing the ABORT message.
     */
    export class Abort implements WampMessage {
        type = WampType.ABORT;
        constructor(public details : WampObject, public reason : WampUriString) {

        }

        toTransportFormat() {
            return [this.type, this.details, this.reason];
        }
    }

    /**
     * A class representing the GOODBYE message.
     */
    export class Goodbye implements WampMessage {
        type = WampType.GOODBYE;
        constructor(public details : WampObject, public reason : WampUriString) {

        }

        toTransportFormat() {
            return [this.type, this.details, this.reason];
        }
    }

    /**
     * A class representing the PUBLISH message.
     */
    export class Publish implements WampMessage {
        type = WampType.PUBLISH;
        constructor(public requestId : WampId, public options : WampPublishOptions, public topic : WampUriString, public args ?: WampArray, public kwargs ?: WampObject) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.topic, ...argsKwargsArray(this.args, this.kwargs)];
        }
    }

    /**
     * A class representing the SUBSCRIBE message.
     */
    export class Subscribe implements WampMessage {
        type = WampType.SUBSCRIBE;
        constructor(public requestId : WampId, public options : WampSubscribeOptions, public topic : WampUriString) {

        }
        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.topic];
        }
    }

    /**
     * A class representing the UNSUBSCRIBE message.
     */
    export class Unsubscribe implements WampMessage {
        type = WampType.UNSUBSCRIBE;
        constructor(public requestId : WampId, public subscription : WampId) {

        }
        toTransportFormat() {
            return [this.type, this.requestId, this.subscription];
        }
    }

    /**
     * A class representing the REGISTER message.
     */
    export class Register  {
        type = WampType.REGISTER;

        constructor(public requestId : WampId, public options : WampRegisterOptions, public procedure : WampUriString) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.procedure];
        }
    }

    /**
     * A class representing an unknown message.
     */
    export class Unknown {
        type = WampType._Unknown;
        constructor(public raw : WampArray) {

        }
    }

    /**
     * A class representing the UNREGISTER message.
     */
    export class Unregister  {
        type = WampType.UNREGISTER;

        constructor(public requestId : WampId, public registration : WampId) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.registration];
        }
    }

    /**
     * A class representing the YIELD message.
     */
    export class Yield implements WampMessage {
        type = WampType.YIELD;

        constructor(public invocationId : WampId, public options : WampYieldOptions, public args ?: WampArray, public kwargs ?: WampObject) {

        }

        toTransportFormat() {
            return [this.type, this.invocationId, this.options, ...argsKwargsArray(this.args, this.kwargs)];
        }
    }

    /**
     * A class representing the WELCOME message.
     */
    export class Welcome implements WampMessage {
        type = WampType.WELCOME;

        constructor(public sessionId : WampId, public details : WelcomeDetails) {

        }
    }

    /**
     * A class representing the PUBLISHED message.
     */
    export class Published implements WampMessage {
        type = WampType.PUBLISHED;

        constructor(public publishReqId : WampId, public publicationId : WampId) {

        }
    }

    /**
     * A class representing the SUBSCRIBED message.
     */
    export class Subscribed implements WampMessage {
        type = WampType.SUBSCRIBED;

        constructor(public subscribeReqId : WampId, public subscriptionId : WampId) {

        }
    }

    /**
     * A class representing the UNSUBSCRIBED message.
     */
    export class Unsubscribed implements WampMessage {
        type = WampType.UNSUBSCRIBED;

        constructor(public unsubscribeReqId : WampId) {

        }
    }

    /**
     * A class representing the EVENT message.
     */
    export class Event implements WampMessage {
        type = WampType.EVENT;

        constructor(public subscriptionId : WampId, public publicationId : WampId, public details : WampEventOptions, public args ?: WampArray, public kwargs ?: WampObject) {
            this.args = this.args || [];
            this.kwargs = this.kwargs || {};
        }
    }

    /**
     * A class representing the RESULT message.
     */
    export class Result implements WampMessage {
        type = WampType.RESULT;

        constructor(public callReqId : WampId, public details : WampResultOptions, public args ?: WampArray, public kwargs ?: WampObject) {

        }
    }

    /**
     * A class representing the REGISTERED message.
     */
    export class Registered implements WampMessage {
        type = WampType.REGISTERED;

        constructor(public registerReqId : WampId, public registrationId : WampId) {

        }
    }

    /**
     * A class representing the UNREGISTERED message.
     */
    export class Unregistered implements WampMessage {
        type = WampType.UNREGISTERED;

        constructor(public unregisterReqId : WampId) {

        }
    }

    /**
     * A class representing the INVOCATION message.
     */
    export class Invocation implements WampMessage{
        type = WampType.INVOCATION;

        constructor(public requestId : WampId, public registrationId : WampId, public options : WampInvocationOptions, public args ?: WampArray, public kwargs ?: WampObject) {

        }
    }

    /**
     * A class representing the CHALLENGE message.
     */
    export class Challenge implements WampMessage {
        type = WampType.CHALLENGE;

        constructor(public authMethod : string, public extra : WampObject) {

        }
    }

    /**
     * A class representing the CANCEL message.
     */
    export class Cancel implements WampMessage {
        type = WampType.CANCEL;

        constructor(public callRequestId : WampId, public options : WampCancelOptions) {

        }

        toTransportFormat() {
            return [this.type, this.callRequestId, this.options];
        }
    }

    /**
     * A class representing the INTERRUPT message.
     */
    export class Interrupt implements WampMessage {
        type = WampType.INTERRUPT;

        constructor(public callRequestId : WampId, public options : WampObject) {

        }
    }

    /**
     * A class representing the AUTHENTICATE message.
     */
    export class Authenticate implements WampMessage {
        type = WampType.AUTHENTICATE;

        constructor(public signature : string, public extra : WampObject) {

        }

        toTransportFormat() {
            return [this.type, this.signature, this.extra];
        }
    }

    /**
     * A union representing any specific WAMP protocol message.
     */
    export type Any = Cancel | Unknown  | Interrupt | Authenticate | Challenge | Hello | Welcome | Abort | Goodbye | Error | Publish | Published | Subscribe | Subscribed | Unsubscribe | Unsubscribed | Event | Call | Result | Register | Registered | Unregister | Unregistered | Invocation | Yield;
}
