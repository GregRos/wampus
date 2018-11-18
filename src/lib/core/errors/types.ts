import * as template from "string-template";
import {WampArray, WampMessage, WampObject} from "../protocol/messages";
import {
	ObjectHelpers
} from "../../utils/object";

/**
 * The base class for errors thrown by the Wampus library.
 */
export abstract class WampusError extends Error {
    name = this.constructor.name;
    constructor(message: string, props: object) {
        super(template(message, props || {}));
	    ObjectHelpers.assignKeepDescriptor(this, props);
	    ObjectHelpers.makeNonEnumerable(this, "name");
    }
}

/**
 * Thrown when an argument supplied to a function was invalid.
 */
export class WampusInvalidArgument extends WampusError {
	constructor(message : string, props : object) {
		super(message, props)
	}
}

/**
 * Thrown when a network issue has prevented an action from completing, such as:
 * 1. A transport issue
 * 2. A WAMP protocol violation.
 * 3. A valid WAMP response with the `network_failure` error code.
 */
export class WampusNetworkError extends WampusError {
    constructor(message: string, props ?: Record<string, any>) {
        super(message, props || {});

    }
}

/**
 * Thrown when the operation the caller tried to perform was invalid, such as:
 * 1. Trying to register a procedure with an invalid name.
 * 2. Trying to use a feature that wasn't enabled for the session.
 * 3. A valid WAMP response with an appropriate error code.
 */
export class WampusIllegalOperationError extends WampusError {

}

/**
 * Thrown when a WAMP operation succeeds with an error state, such as if the target of an RPC call threw an exception or was cancelled.
 */
export class WampusInvocationError extends WampusError {
	args : WampArray;
	kwargs : WampObject;
	error : string;
	details : any;

}
ObjectHelpers.makeEverythingNonEnumerableExcept(WampusInvocationError.prototype, "kwargs", "args", "details");

/**
 * Thrown when a WAMP RPC call is canceled.
 */
export class WampusInvocationCanceledError extends WampusError {
}
