import {WampMsgType} from "./message.type";
import {WampusIllegalOperationError} from "../errors/types";
import {
    WampCallOptions,
    WampMessage,
    WampPublishOptions,
    WampRawMessage,
    WampRegisterOptions,
    WampSubscribeOptions,
    WampYieldOptions
} from "./messages";

export class WampMessageFactory {
    constructor(private _requestIdProvider: () => number) {

    }

    hello(realm: string, details: object) {
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
                return new WampMessage.Call(raw[1], raw[], raw[3], raw[3], raw[5]);
            case WampMsgType.Register:
                return new WampMessage.Register(raw[1], raw[], raw[3]);
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