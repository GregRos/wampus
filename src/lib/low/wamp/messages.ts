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

export type WampRawMessage = any[];



export interface WampMessage {
     type : WampType;
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

export module WampMessage {
    export class Call implements WampMessage{
        type = WampType.CALL;
        constructor(public requestId : number, public options : WampCallOptions, public procedure : string, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            let {args,kwargs} = this;
            return [this.type, this.requestId, this.options || {}, ...argsKwargsArray(args, kwargs)];
        }
    }

    export class Error implements WampMessage {
        type = WampType.ERROR;
        constructor(public errSourceType : WampType, public errSourceId : number, public details : any, public error : string, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            return [this.type, this.errSourceType, this.errSourceId, this.details, this.error];
        }
    }

    export class Hello implements WampMessage {
        type = WampType.HELLO;
        constructor(public realm : string, public details : HelloDetails) {

        }

        toTransportFormat() {
            return [this.type, this.realm, this.details];
        }
    }

    export class Abort implements WampMessage {
        type = WampType.ABORT;
        constructor(public details : Record<string, any>, public reason : string) {

        }

        toTransportFormat() {
            return [this.type, this.details, this.reason];
        }
    }

    export class Goodbye implements WampMessage {
        type = WampType.GOODBYE;
        constructor(public details : Record<string, any>, public reason : string) {

        }

        toTransportFormat() {
            return [this.type, this.details, this.reason];
        }
    }

    export class Publish implements WampMessage {
        type = WampType.PUBLISH;
        constructor(public requestId : number, public options : WampPublishOptions, public topic : string, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.topic, ...argsKwargsArray(this.args, this.kwargs)];
        }
    }

    export class Subscribe implements WampMessage {
        type = WampType.SUBSCRIBE;
        constructor(public requestId : number, public options : WampSubscribeOptions, public topic : string) {

        }
        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.topic];
        }
    }

    export class Unsubscribe implements WampMessage {
        type = WampType.UNSUBSCRIBE;
        constructor(public requestId : number, public subscription : number) {

        }
        toTransportFormat() {
            return [this.type, this.requestId, this.subscription];
        }
    }

    export class Register  {
        type = WampType.REGISTER;

        constructor(public requestId : number, public options : WampRegisterOptions, public procedure : string) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.options, this.procedure];
        }
    }

    export class Unknown {
        type = WampType._Unknown;
        constructor(public raw : any[]) {

        }
    }

    export class Unregister  {
        type = WampType.UNREGISTER;

        constructor(public requestId : number, public registration : number) {

        }

        toTransportFormat() {
            return [this.type, this.requestId, this.registration];
        }
    }

    export class Yield implements WampMessage {
        type = WampType.YIELD;

        constructor(public invocationId : number, public options : WampYieldOptions, public args ?: any[], public kwargs ?: any) {

        }

        toTransportFormat() {
            return [this.type, this.invocationId, this.options, ...argsKwargsArray(this.args, this.kwargs)];
        }
    }

    export class Welcome implements WampMessage {
        type = WampType.WELCOME;

        constructor(public sessionId : number, public details : WelcomeDetails) {

        }
    }

    export class Published implements WampMessage {
        type = WampType.PUBLISHED;

        constructor(public publishReqId : number, public publicationId : number) {

        }
    }

    export class Subscribed implements WampMessage {
        type = WampType.SUBSCRIBED;

        constructor(public subscribeReqId : number, public subscriptionId : number) {

        }
    }

    export class Unsubscribed implements WampMessage {
        type = WampType.UNSUBSCRIBED;

        constructor(public threadId : number) {

        }
    }

    export class Event implements WampMessage {
        type = WampType.EVENT;

        constructor(public subscriptionId : number, public publicationId : number, public details : WampEventOptions, public args ?: any[], public kwargs ?: any) {
            this.args = this.args || [];
            this.kwargs = this.kwargs || {};
        }
    }

    export class Result implements WampMessage {
        type = WampType.RESULT;

        constructor(public callReqId : number, public details : WampResultOptions, public args ?: any[], public kwargs ?: any) {

        }
    }

    export class Registered implements WampMessage {
        type = WampType.REGISTERED;

        constructor(public threadId : number, public registrationId : number) {

        }
    }

    export class Unregistered implements WampMessage {
        type = WampType.UNREGISTERED;

        constructor(public unregisterReqId : number) {

        }
    }

    export class Invocation implements WampMessage{
        type = WampType.INVOCATION;

        constructor(public requestId : number, public registrationId : number, public options : WampInvocationOptions, public args ?: any[], public kwargs ?: any) {

        }
    }

    export class Challenge implements WampMessage {
        type = WampType.CHALLENGE;

        constructor(public authMethod : string, public extra : object) {

        }
    }

    export class Cancel implements WampMessage {
        type = WampType.CANCEL;

        constructor(public callRequestId : number, public options : WampCancelOptions) {

        }

        toTransportFormat() {
            return [this.type, this.callRequestId, this.options];
        }
    }

    export class Interrupt implements WampMessage {
        type = WampType.INTERRUPT;

        constructor(public callRequestId : number, public options : object) {

        }
    }

    export class Authenticate implements WampMessage {
        type = WampType.AUTHENTICATE;

        constructor(public signature : string, public extra : object) {

        }

        toTransportFormat() {
            return [this.type, this.signature, this.extra];
        }
    }


    export type Any = Cancel | Unknown | Interrupt | Authenticate | Challenge | Hello | Welcome | Abort | Goodbye | Error | Publish | Published | Subscribe | Subscribed | Unsubscribe | Unsubscribed | Event | Call | Result | Register | Registered | Unregister | Unregistered | Invocation | Yield;

    export type SendableMessage = Any & {toTransportFormat() : any[]};


}

