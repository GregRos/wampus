import {
    HelloDetails,
    WampCallOptions,
    WampCancelOptions,
    WampEventOptions,
    WampInvocationOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampResultOptions,
    WampSubscribeOptions,
    WampYieldOptions,
    WelcomeDetails
} from "./options";
import {WampArray, WampId, Wamp, WampObject, WampUriString} from "./messages";
import {WampType} from "./message.type";

export interface MessageFactoryConfig {
    requestId(): number;
}

/**
 * A helper class for creating commonly used message objects and embedding them with request IDs.
 */
export class MessageFactory {
    constructor(private _config: MessageFactoryConfig) {

    }


    hello(realm: string, details: HelloDetails) {
        return new Wamp.Hello(realm, details);
    }

    abort(details: WampObject, reason: WampUriString) {
        return new Wamp.Abort(details, reason);
    }

    call(options: WampCallOptions, procedure: WampUriString, args ?: WampArray, kwargs ?: any) {
        return new Wamp.Call(this._config.requestId(), options || {}, procedure, args || [], kwargs || {});
    }

    publish(options: WampPublishOptions, topic: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Publish(this._config.requestId(), options || {}, topic, args || [], kwargs || {});
    }

    subscribe(options: WampSubscribeOptions, topic: WampUriString) {
        return new Wamp.Subscribe(this._config.requestId(), options || {}, topic);
    }

    unsubscribe(subscription: WampId) {
        return new Wamp.Unsubscribe(this._config.requestId(), subscription);
    }

    register(options: WampRegisterOptions, procedure: WampUriString) {
        return new Wamp.Register(this._config.requestId(), options || {}, procedure);
    }


    error(sourceType: WampType, requestId: WampId, details: WampObject, reason: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Error(sourceType, requestId, details || {}, reason, args || [], kwargs || {});
    }

    unregister(registration: WampId) {
        return new Wamp.Unregister(this._config.requestId(), registration);
    }

    yield(invocationId: WampId, options: WampYieldOptions, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Yield(invocationId, options || {}, args || [], kwargs || {});
    }

    cancel(callRequestId: WampId, options: WampCancelOptions) {
        return new Wamp.Cancel(callRequestId, options || {});
    }

    authenticate(signature: string, options: object) {
        return new Wamp.Authenticate(signature, options || {});
    }

    goodbye(details: WampObject, reason: WampUriString) {
        return new Wamp.Goodbye(details || {}, reason);
    }

    unregistered(reqId: WampId) {
        return new Wamp.Unregistered(reqId);
    }

    result(callReqId: WampId, details: WampResultOptions, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Result(callReqId, details || {}, args, kwargs);
    }

    registered(registerReqId: WampId) {
        return new Wamp.Registered(registerReqId, this._config.requestId());
    }

    challenge(authMethod: string, extra: WampObject) {
        return new Wamp.Challenge(authMethod, extra);
    }

    subscribed(subscribeReqId: WampId) {
        return new Wamp.Subscribed(subscribeReqId, this._config.requestId());
    }

    event(subscriptionId: WampId, details ?: WampEventOptions, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Event(subscriptionId, this._config.requestId(), details || {}, args, kwargs);
    }

    invocation(registrationId: WampId, options ?: WampInvocationOptions, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Invocation(this._config.requestId(), registrationId, options || {}, args, kwargs);
    }

    welcome(details: WelcomeDetails) {
        return new Wamp.Welcome(this._config.requestId(), details);
    }

    unsubscribed(unsubscribeReqId: WampId) {
        return new Wamp.Unsubscribed(unsubscribeReqId);
    }

}