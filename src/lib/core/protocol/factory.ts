import {
    HelloDetails,
    WampCallOptions,
    WampCancelOptions,
    WampEventDetails,
    WampInvocationDetails,
    WampPublishOptions,
    WampRegisterOptions,
    WampResultDetails,
    WampSubscribeOptions,
    WampYieldOptions,
    WelcomeDetails,
    WampArray, WampId, Wamp, WampObject, WampUriString, WampType
} from "typed-wamp";

/**
 * Used to configure the message factory.
 */
export interface MessageFactoryConfig {
    // Returns a new request ID.
    reqId(): number;
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
        return new Wamp.Call(this._config.reqId(), options || {}, procedure, args || [], kwargs || {});
    }

    publish(options: WampPublishOptions, topic: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Publish(this._config.reqId(), options || {}, topic, args || [], kwargs || {});
    }

    subscribe(options: WampSubscribeOptions, topic: WampUriString) {
        return new Wamp.Subscribe(this._config.reqId(), options || {}, topic);
    }

    unsubscribe(subscription: WampId) {
        return new Wamp.Unsubscribe(this._config.reqId(), subscription);
    }

    register(options: WampRegisterOptions, procedure: WampUriString) {
        return new Wamp.Register(this._config.reqId(), options || {}, procedure);
    }


    error(sourceType: WampType, requestId: WampId, details: WampObject, reason: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Error(sourceType, requestId, details || {}, reason, args || [], kwargs || {});
    }

    unregister(registration: WampId) {
        return new Wamp.Unregister(this._config.reqId(), registration);
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

    result(callReqId: WampId, details: WampResultDetails, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Result(callReqId, details || {}, args, kwargs);
    }

    registered(registerReqId: WampId) {
        return new Wamp.Registered(registerReqId, this._config.reqId());
    }

    event(subscriptionId: WampId, details ?: WampEventDetails, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Event(subscriptionId, this._config.reqId(), details || {}, args, kwargs);
    }

    invocation(registrationId: WampId, options ?: WampInvocationDetails, args ?: WampArray, kwargs ?: WampObject) {
        return new Wamp.Invocation(this._config.reqId(), registrationId, options || {}, args, kwargs);
    }

}