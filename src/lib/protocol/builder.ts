import {
    HelloDetails,
    WampCallOptions,
    WampCancelOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampSubscribeOptions,
    WampYieldOptions
} from "./options";
import {
    WampArray,
    WampId,
    WampMessage,
    WampObject,
    WampUriString,
    WampusCompletionReason,
    WampusRouteCompletion
} from "./messages";
import {WampType} from "./message.type";

export class MessageBuilder {
    constructor(private _requestIdProvider: () => number) {

    }

    hello(realm: string, details: HelloDetails) {
        return new WampMessage.Hello(realm, details);
    }

    abort(details: WampObject, reason: WampUriString) {
        return new WampMessage.Abort(details, reason);
    }

    call(options: WampCallOptions, procedure: WampUriString, args ?: WampArray, kwargs ?: any) {
        return new WampMessage.Call(this._requestIdProvider(), options || {}, procedure, args || [], kwargs || {});
    }

    publish(options: WampPublishOptions, topic: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new WampMessage.Publish(this._requestIdProvider(), options || {}, topic, args || [], kwargs || {});
    }

    subscribe(options: WampSubscribeOptions, topic: WampUriString) {
        return new WampMessage.Subscribe(this._requestIdProvider(), options || {}, topic);
    }

    unsubscribe(subscription: WampId) {
        return new WampMessage.Unsubscribe(this._requestIdProvider(), subscription);
    }

    register(options: WampRegisterOptions, procedure: WampUriString) {
        return new WampMessage.Register(this._requestIdProvider(), options || {}, procedure);
    }

    error(sourceType: WampType, requestId: WampId, details: WampObject, reason: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new WampMessage.Error(sourceType, requestId, details || {}, reason, args || [], kwargs || {});
    }

    unregister(registration: WampId) {
        return new WampMessage.Unregister(this._requestIdProvider(), registration);
    }

    yield(invocationId: WampId, options: WampYieldOptions, args ?: WampArray, kwargs ?: WampObject) {
        return new WampMessage.Yield(invocationId, options || {}, args || [], kwargs || {});
    }

    cancel(callRequestId: WampId, options: WampCancelOptions) {
        return new WampMessage.Cancel(callRequestId, options || {});
    }

    authenticate(signature: string, options: object) {
        return new WampMessage.Authenticate(signature, options || {});
    }

    goodbye(details: WampObject, reason: WampUriString) {
        return new WampMessage.Goodbye(details || {}, reason);
    }

    internalRouteCompletion(reason: WampusCompletionReason) {
        return new WampusRouteCompletion(reason);
    }

}