import template = require("string-template");

export class WampusError extends Error {
    constructor(message: string, props: object) {
        super(template(message, props || {}));
        Object.assign(this, props);
    }
}

/**
 * Thrown when an error occurs in a transport protocol or the WAMP protocol itself.
 * This includes the following WAMP error codes:
 * 1. wamp.error.invalid_uri
 * 2. wamp.error.protocol_violation
 *
 * In the following additional situations:
 *
 */
export class WampusNetworkError extends WampusError {
    constructor(message: string, props ?: Record<string, any>) {
        super(message, props);
    }
}

/**
 * Thrown when a WAMP operation fails due to a technical reason, such as an RPC call being unknown.
 * Not thrown when an RPC call succeeds with an error state.
 */
export class WampusIllegalOperationError extends WampusError {

}

/**
 * Thrown when a WAMP operation succeeds with an error state, such as if the target of an RPC call threw an exception.
 */
export class WampusInvocationError extends WampusError {

}

/**
 * Thrown when a WAMP RPC call is canceled.
 */
export class WampusInvocationCanceledError extends WampusError {

}