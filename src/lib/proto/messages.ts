import {WampusIllegalOperationError} from "../errors/errors";
import {WampMsgType} from "./message.type";

export type WampRawMessage = any[];

export interface WampCallOptions {

}

export interface WampPublishOptions {

}

export interface WampSubscribeOptions {

}

export interface WampRegisterOptions {

}

export interface WampYieldOptions {

}

export interface WampEventOptions {

}

export interface WampResultOptions {

}

export interface WampInvocationOptions {

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

export class WampMessageFactory {
    constructor(private _requestIdProvider : () => number) {

    }

    hello(realm : string, details : object) {
        return new WampMessage.Hello(realm, details);
    }

    abort(details : object, reason : string) {
        return new WampMessage.Abort(details, reason);
    }

    call(options : WampCallOptions, procedure : string, args ?: any[], kwargs ?: any) {
        return new WampMessage.Call(this._requestIdProvider(), options, procedure, args, kwargs);
    }

    publish(options : WampPublishOptions, topic : string, args ?: any[], kwargs ?: any) {
        return new WampMessage.Publish(this._requestIdProvider(), options, topic, args, kwargs);
    }

    subscribe(options : WampSubscribeOptions, topic : string) {
        return new WampMessage.Subscribe(this._requestIdProvider(), options, topic);
    }

    unsubscribe(subscription : number) {
        return new WampMessage.Unsubscribe(this._requestIdProvider(), subscription);
    }

    register(options : WampRegisterOptions, procedure : string) {
        return new WampMessage.Register(this._requestIdProvider(), options, procedure);
    }

    unregister(registration : number) {
        return new WampMessage.Unregister(this._requestIdProvider(), registration);
    }

    yield(invocationId : number, options : WampYieldOptions, args ?: any[], kwargs : any) {
        return new WampMessage.Yield(invocationId, options, args, kwargs);
    }

    cancel(callRequestId : number, options : object) {
        return new WampMessage.Cancel(callRequestId, options);
    }

    authenticate(signature : string, options : object) {
        return new WampMessage.Authenticate(signature, options);
    }

     read(raw : WampRawMessage) : WampMessage.Any {
        switch (raw[0]) {
            case WampMsgType.Welcome:
                return new WampMessage.Welcome(raw[1], raw[2]);
            case WampMsgType.Abort:
                return new WampMessage.Abort(raw[1], raw[2]);
            case WampMsgType.Goodbye:
                return new WampMessage.Goodbye(raw[1], raw[2]);
            case WampMsgType.Error:
                return new WampMessage.Error(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampMsgType.Published:
                return new WampMessage.Published(raw[1], raw[2]);
            case WampMsgType.Subscribed:
                return new WampMessage.Subscribed(raw[1], raw[2]);
            case WampMsgType.Unsubscribed:
                return new WampMessage.Unsubscribed(raw[1]);
            case WampMsgType.Event:
                return new WampMessage.Event(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampMsgType.Result:
                return new WampMessage.Result(raw[1], raw[2], raw[3], raw[4]);
            case WampMsgType.Registered:
                return new WampMessage.Registered(raw[1], raw[2]);
            case WampMsgType.Unregistered:
                return new WampMessage.Unregistered(raw[1]);
            case WampMsgType.Invocation:
                return new WampMessage.Invocation(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampMsgType.Challenge:
                return new WampMessage.Challenge(raw[1], raw[2]);
            case WampMsgType.Interrupt:
                return new WampMessage.Interrupt(raw[1], raw[2]);
            case WampMsgType.Subscribe:
            case WampMsgType.Unregister:
            case WampMsgType.Publish:
            case WampMsgType.Call:
            case WampMsgType.Register:
            case WampMsgType.Hello:
            case WampMsgType.Yield:
            case WampMsgType.Authenticate:
            case WampMsgType.Cancel:
                throw new WampusIllegalOperationError("Received a WAMP message not intended for clients.", {
                    type : WampMsgType[raw[0]],
                    msg : raw
                });
            default:
                throw new WampusIllegalOperationError("Received a WAMP message of an unrecognized type.", {
                    type : raw[0],
                    msg : raw
                });
        }
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
        constructor(public realm : string, public details : Record<string, any>) {

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

        constructor(public sessionId : number, public details : any) {

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

        constructor(public callReqId : number, details : WampResultOptions, args ?: any[], kwargs ?: any) {

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


    export type Any = Cancel | Interrupt | Authenticate | Challenge | Hello | Welcome | Abort | Goodbye | Error | Publish | Published | Subscribe | Subscribed | Unsubscribe | Unsubscribed | Event | Call | Result | Register | Registered | Unregister | Unregistered | Invocation | Yield;


}

