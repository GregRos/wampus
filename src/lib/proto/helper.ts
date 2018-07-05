import {WampMsgType} from "./message.type";
import {WampusIllegalOperationError} from "../errors/types";
import {
    HelloDetails,
    WampCallOptions,
    WampMessage,
    WampPublishOptions,
    WampRawMessage,
    WampRegisterOptions,
    WampSubscribeOptions,
    WampYieldOptions
} from "./messages";

export class WampMsgHelper {
    constructor(private _requestIdProvider: () => number) {

    }

    hello(realm: string, details: HelloDetails) {
        return new WampMessage.Hello(realm, details);
    }

    abort(details: object, reason: string) {
        return new WampMessage.Abort(details, reason);
    }

    call(options: WampCallOptions, procedure: string, args ?: any[], kwargs ?: any) {
        return new WampMessage.Call(this._requestIdProvider(), options, procedure, args, kwargs);
    }

    publish(options: WampPublishOptions, topic: string, args ?: any[], kwargs ?: any) {
        return new WampMessage.Publish(this._requestIdProvider(), options, topic, args, kwargs);
    }

    subscribe(options: WampSubscribeOptions, topic: string) {
        return new WampMessage.Subscribe(this._requestIdProvider(), options, topic);
    }

    unsubscribe(subscription: number) {
        return new WampMessage.Unsubscribe(this._requestIdProvider(), subscription);
    }

    register(options: WampRegisterOptions, procedure: string) {
        return new WampMessage.Register(this._requestIdProvider(), options, procedure);
    }

    error(sourceType : WampMsgType, requestId : number, details : any, name : string, args : any[], kwargs : any) {
        return new WampMessage.Error(sourceType, requestId, details, name, args, kwargs);
    }

    unregister(registration: number) {
        return new WampMessage.Unregister(this._requestIdProvider(), registration);
    }

    yield(invocationId: number, options: WampYieldOptions, args ?: any[], kwargs ?: any) {
        return new WampMessage.Yield(invocationId, options, args, kwargs);
    }

    cancel(callRequestId: number, options: object) {
        return new WampMessage.Cancel(callRequestId, options);
    }

    authenticate(signature: string, options: object) {
        return new WampMessage.Authenticate(signature, options);
    }

    expect = {
        goodbye : [WampMsgType.Goodbye],
        error(type : WampMsgType, param2 ?: number) {
            return param2 ? [WampMsgType.Error, type, param2] : [type];
        },
        published(publishReqId : number) {
            return [WampMsgType.Published, publishReqId];
        },
        subscribed(subReqId : number) {
            return [WampMsgType.Subscribed, subReqId];
        },
        unsubscribed(unsubReqId : number) {
            return [WampMsgType.Unsubscribed, unsubReqId];
        },
        event(subId : number) {
            return [WampMsgType.Event, subId];
        },
        registered(registerReqId : number) {
            return [WampMsgType.Registered, registerReqId];
        },
        unregistered(registrationId : number) {
            return [WampMsgType.Unregistered, registrationId];
        },
        invocation(registrationId : number) {
            // NOTE: This isn't the actual order of the fields for an INVOCATION message.
            // The fields need to be reordered in this one special case. Indexes 1, 2 must be switched.
            return [WampMsgType.Invocation, registrationId];
        },
        result(reqId : number) {
            return [WampMsgType.Result, reqId];
        }

    };

    read(raw: WampRawMessage): WampMessage.Any {
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
                return new WampMessage.Subscribe(raw[1], raw[2], raw[3]);
            case WampMsgType.Unregister:
                return new WampMessage.Unregister(raw[1], raw[2]);
            case WampMsgType.Publish:
                return new WampMessage.Publish(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampMsgType.Call:
                return new WampMessage.Call(raw[1], raw[2], raw[3], raw[3], raw[5]);
            case WampMsgType.Register:
                return new WampMessage.Register(raw[1], raw[2], raw[3]);
            case WampMsgType.Hello:
                return new WampMessage.Hello(raw[1], raw[2]);
            case WampMsgType.Yield:
                return new WampMessage.Yield(raw[1], raw[2]);
            case WampMsgType.Authenticate:
                return new WampMessage.Authenticate(raw[1], raw[2]);
            case WampMsgType.Cancel:
                return new WampMessage.Cancel(raw[1], raw[2]);
            default:
                return new WampMessage.Unknown(raw);
        }
    }
}