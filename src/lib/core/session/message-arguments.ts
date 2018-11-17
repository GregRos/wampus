import {WampArray, WampObject, WampUriString} from "../protocol/messages";
import {
    WampCallOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampResultOptions,
    WampSubscribeOptions,
    WampYieldOptions
} from "../protocol/options";

/**
 * The info Wampus needs to call a procedure.
 */
export interface WampusCallArguments {
	/**
	 * The name of the procedure.
	 */
    name: string;
	/**
	 * WAMP protocol options.
	 */
	options?: WampCallOptions;
	/**
	 * Sequential arguments.
	 */
    args?: WampArray;
	/**
	 * Named arguments.
	 */
	kwargs?: WampObject;
}

/**
 * The info Wampus needs to publish an event.
 */
export interface WampusPublishArguments {
	/**
	 * The name of the topic to publish.
	 */
    name: string;
	/**
	 * WAMP protocol options.
	 */
	options?: WampPublishOptions;
	/**
	 * Sequential arguments.
	 */
    args?: WampArray;
	/**
	 * Named arguments.
	 */
	kwargs?: WampObject;
}

/**
 * The info Wampus needs to send a data response to an invocation.
 */
export interface WampusSendResultArguments {
	/**
	 * Named arguments.
	 */
    kwargs?: WampObject;
	/**
	 * Sequential arguments.
	 */
	args?: WampArray;
	/**
	 * WAMP protocol options.
	 */
    options?: WampYieldOptions;
}

/**
 * The info Wampus needs to send an error response to an invocation.
 */
export interface WampusSendErrorArguments {
	/**
	 * Sequential arguments.
	 */
    args?: WampArray;
	/**
	 * Named arguments.
	 */
	kwargs?: WampObject;
	/**
	 * URI string denoting the error name
	 */
    error: WampUriString;
	/**
	 * Additional details.
	 */
	details?: WampObject;
}

/**
 * The info Wampus needs to subscribe to a topic.
 */
export interface WampusSubcribeArguments {
	/**
	 * WAMP protocol options for the subscription.
	 */
    options?: WampSubscribeOptions;

	/**
	 * The topic to subscribe to.
	 */
	name: string;
}

/**
 * The info Wampus needs to register a procedure.
 */
export interface WampusRegisterArguments {
	/**
	 * WAMP protocol options for the registration.
	 */
    options?: WampRegisterOptions;

	/**
	 * The name of the procedure to register.
	 */
	name: string;
}

