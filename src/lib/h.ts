import template = require("string-template");

export enum ErrorLevel {
    Transport = "Transport",
    Wamp = "Wamp"
}

export class WampusError extends Error {
    constructor(message : string, props : object) {
        super(template(message, props));
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
    constructor(level : "Transport" | "Wamp", message : string, props : Record<string, any>) {
        super(message, Object.assign(props, {
            level
        }));
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

export module Codes {
    export enum error {
        NotAuthorized = "wamp.error.not_authorized",
        ProcAlreadyExists = "wamp.error.procedure_already_exists",
        ProtoViolation = "wamp.error.protocol_violation",
        NoSuchRealm = "wamp.error.no_such_realm",
        NoSuchSubscription = "wamp.error.no_such_subscription",
        NoSuchRegistration = "wamp.error.no_such_registration",
        NoSuchProedure = "wamp.error.no_such_procedure",
        InvalidUri = "wamp.error.invalid_uri",
        InvalidArgument = "wamp.error.invalid_argument",
        AuthFailed = "wamp.error.authorization_failed",
        NoSuchRole = "wamp.error.no_such_role",
        NoSuchSession = "wamp.error.no_such_session",
        // Advanced Profile
        Canceled = "wamp.error.canceled",
        OptionNotAllowed = "wamp.error.option_not_allowed",
        NoEligibleCallee = "wamp.error.no_eligible_callee",
        DisallowedDiscloseMe = "wamp.error.option_disallowed.disclose_me",
        NetworkFailure = "wamp.error.network_failure",
    }

    export enum close {

    }
}



export module NetworkErrors {
    export function wampViolation(info : string, context : Record<string, any>) {
        return new WampusNetworkError("Wamp", "A WAMP protocol violation error occurred. More info: {info}.", {
            info,
            ...context,
            code : Codes.error.ProtoViolation
        });
    }

    export function networkFailure(IMPLEMENT : never) {

    }


}

export module IllegalOperations {
    export function noSuchProcedure(name : string, realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, attempted to call procedure {name}, but it did not exist.", {
            realm,
            name,
            code : Codes.error.NoSuchProedure
        });
    }

    export function notAuthorized(operation : string, realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, this session is not authorized to perform the specified operation: {operation}", {
            operation,
            realm,
            code : Codes.error.NotAuthorized
        });
    }

    export function procedureAlreadyExists(name : string, realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to register operation {name}, but it's already registered.", {
            name,
            realm,
            code : Codes.error.ProcAlreadyExists
        });
    }

    export function noSuchRealm(realm : string) {
        return new WampusIllegalOperationError("Tried to join realm {realm}, but it did not exist, and the router refused to auto-create it.", {
            realm,
            code : Codes.error.NoSuchRealm
        });
    }

    export function noSuchSubscription(event : string, realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to unsubscribe from event {event}, but the subscription did not exist. It may have already been closed.", {
            event,
            realm,
            code : Codes.error.NoSuchSubscription
        });
    }

    export function noSuchRegistration(name : string, realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to unregister procedure {name}, but it wasn't registrered to this session.", {
            name,
            realm,
            code : Codes.error.NoSuchRegistration
        });
    }

    export function invalidArgument(name : string, realm : string, message : string){
        return new WampusIllegalOperationError("In realm {realm}, called procedure {name}, but the given arguments failed validation. This error may be thrown by the router or callee.", {
            name,
            realm,
            code : Codes.error.InvalidArgument
        });
    }

    export function authFailed(IMPLEMENT : never) {

    }

    export function noSuchRole(role : string, realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to authenticate under role {role}, but the role did not exist. This may indicate a problem in the router.", {
            role,
            realm,
            code : Codes.error.NoSuchRole
        });
    }

    export function canceled(name : string, realm : string) {
        return new WampusInvocationCanceledError("In realm {realm}, called {name} successfuly, but the call was canceled before its result could be processed.", {
            name,
            realm,
            code : Codes.error.Canceled
        });
    }

    export function optionNotAllowed(realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, this peer requested an interaction that was disallowed by the router.", {
            realm,
            code : Codes.error.OptionNotAllowed
        });
    }

    export function noEligibleCallee(name : string, realm : string, filters : Record<string, any>) {
        return new WampusIllegalOperationError("In realm {realm}, this peer tried to call procedure {name} with exclusions, but no callee matching the exclusions was found.", {
            realm,
            name,
            filters,
            code : Codes.error.NoEligibleCallee
        });
    }

    export function optionDisallowedDiscloseMe(name : string, realm : string ){
        return new WampusIllegalOperationError("In realm {realm}, this peer tried to call the procedure {name} with the disclose_me flag, but the router refused the flag.", {
            realm,
            name,
            code : Codes.error.DisallowedDiscloseMe
        });
    }

    export function noSuchSession(session : number | string, realm : string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to get information about session {session}, but it did not exist.", {
            session,
            realm,
            code : Codes.error.ProtoViolation
        })
    }
}




export class Wampus


/**
 * Thrown when a protocol violation occurs in the WAMP protocol or the transport protocol
 */
export class TransportProtocolError extends Error{

}

export class WampProtocolError
