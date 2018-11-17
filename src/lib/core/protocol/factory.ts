import {
	HelloDetails,
	WampCallOptions,
	WampCancelOptions, WampEventOptions, WampInvocationOptions,
	WampPublishOptions,
	WampRegisterOptions, WampResultOptions,
	WampSubscribeOptions,
	WampYieldOptions, WelcomeDetails
} from "./options";
import {
    WampArray,
    WampId,
    WampMessage,
    WampObject,
    WampUriString} from "./messages";
import {WampType} from "./message.type";
import {WampusCompletionReason} from "../session/route-completion";
import {WampusRouteCompletion} from "../session/route-completion";

export interface MessageFactoryConfig {
    requestId() : number;
}

/**
 * A helper class for creating commonly used message objects and embedding them with request IDs.
 */
export class MessageFactory {
    constructor(private _config : MessageFactoryConfig) {

    }


    hello(realm: string, details: HelloDetails) {
        return new WampMessage.Hello(realm, details);
    }

    abort(details: WampObject, reason: WampUriString) {
        return new WampMessage.Abort(details, reason);
    }

    call(options: WampCallOptions, procedure: WampUriString, args ?: WampArray, kwargs ?: any) {
        return new WampMessage.Call(this._config.requestId(), options || {}, procedure, args || [], kwargs || {});
    }

    publish(options: WampPublishOptions, topic: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new WampMessage.Publish(this._config.requestId(), options || {}, topic, args || [], kwargs || {});
    }

    subscribe(options: WampSubscribeOptions, topic: WampUriString) {
        return new WampMessage.Subscribe(this._config.requestId(), options || {}, topic);
    }

    unsubscribe(subscription: WampId) {
        return new WampMessage.Unsubscribe(this._config.requestId(), subscription);
    }

    register(options: WampRegisterOptions, procedure: WampUriString) {
        return new WampMessage.Register(this._config.requestId(), options || {}, procedure);
    }


    error(sourceType: WampType, requestId: WampId, details: WampObject, reason: WampUriString, args ?: WampArray, kwargs ?: WampObject) {
        return new WampMessage.Error(sourceType, requestId, details || {}, reason, args || [], kwargs || {});
    }

    unregister(registration: WampId) {
        return new WampMessage.Unregister(this._config.requestId(), registration);
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

    unregistered(reqId : WampId) {
    	return new WampMessage.Unregistered(reqId);
    }

    result(callReqId : WampId, details : WampResultOptions, args ?: WampArray, kwargs ?: WampObject) {
    	return new WampMessage.Result(callReqId, details || {}, args, kwargs);
    }

    registered(registerReqId : WampId) {
    	return new WampMessage.Registered(registerReqId, this._config.requestId());
    }

	challenge(authMethod : string, extra : WampObject) {
    	return new WampMessage.Challenge(authMethod, extra);
    }

    subscribed(subscribeReqId : WampId ) {
    	return new WampMessage.Subscribed(subscribeReqId, this._config.requestId());
    }

    event(subscriptionId : WampId, details ?: WampEventOptions, args ?: WampArray, kwargs ?: WampObject) {
    	return new WampMessage.Event(subscriptionId, this._config.requestId(), details || {}, args, kwargs);
    }
    invocation(registrationId : WampId, options ?: WampInvocationOptions, args ?: WampArray, kwargs ?: WampObject) {
    	return new WampMessage.Invocation(this._config.requestId(), registrationId, options ||{}, args, kwargs);
    }

	welcome(details : WelcomeDetails) {
    	return new WampMessage.Welcome(this._config.requestId(), details);
    }

	unsubscribed(unsubscribeReqId : WampId) {
		return new WampMessage.Unsubscribed(unsubscribeReqId);
	}

}