import {WampType} from "./message.type";
import {WampusIllegalOperationError} from "../../errors/types";
import {
    WampMessage,
    WampRawMessage} from "./messages";
import {
    HelloDetails,
    WampCallOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampSubscribeOptions,
    WampYieldOptions
} from "./options";


export module MessageReader {
    export function read(raw: WampRawMessage): WampMessage.Any {
        switch (raw[0]) {
            case WampType.WELCOME:
                return new WampMessage.Welcome(raw[1], raw[2]);
            case WampType.ABORT:
                return new WampMessage.Abort(raw[1], raw[2]);
            case WampType.GOODBYE:
                return new WampMessage.Goodbye(raw[1], raw[2]);
            case WampType.ERROR:
                return new WampMessage.Error(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampType.PUBLISHED:
                return new WampMessage.Published(raw[1], raw[2]);
            case WampType.SUBSCRIBED:
                return new WampMessage.Subscribed(raw[1], raw[2]);
            case WampType.UNSUBSCRIBED:
                return new WampMessage.Unsubscribed(raw[1]);
            case WampType.EVENT:
                return new WampMessage.Event(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampType.RESULT:
                return new WampMessage.Result(raw[1], raw[2], raw[3], raw[4]);
            case WampType.REGISTERED:
                return new WampMessage.Registered(raw[1], raw[2]);
            case WampType.UNREGISTERED:
                return new WampMessage.Unregistered(raw[1]);
            case WampType.INVOCATION:
                return new WampMessage.Invocation(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampType.CHALLENGE:
                return new WampMessage.Challenge(raw[1], raw[2]);
            case WampType.INTERRUPT:
                return new WampMessage.Interrupt(raw[1], raw[2]);
            case WampType.SUBSCRIBE:
                return new WampMessage.Subscribe(raw[1], raw[2], raw[3]);
            case WampType.UNREGISTER:
                return new WampMessage.Unregister(raw[1], raw[2]);
            case WampType.PUBLISH:
                return new WampMessage.Publish(raw[1], raw[2], raw[3], raw[4], raw[5]);
            case WampType.CALL:
                return new WampMessage.Call(raw[1], raw[2], raw[3], raw[3], raw[5]);
            case WampType.REGISTER:
                return new WampMessage.Register(raw[1], raw[2], raw[3]);
            case WampType.HELLO:
                return new WampMessage.Hello(raw[1], raw[2]);
            case WampType.YIELD:
                return new WampMessage.Yield(raw[1], raw[2]);
            case WampType.AUTHENTICATE:
                return new WampMessage.Authenticate(raw[1], raw[2]);
            case WampType.CANCEL:
                return new WampMessage.Cancel(raw[1], raw[2]);
            default:
                return new WampMessage.Unknown(raw);
        }
    }
}
export class MessageBuilder {
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

    error(sourceType : WampType, requestId : number, details : any, name : string, args : any[], kwargs : any) {
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


}