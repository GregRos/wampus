import {AdvProfile, WampUri} from "../protocol/uris";
import {WampType} from "../protocol/message.type";
import {WampMessage, WampObject, WampUriString} from "../protocol/messages";
import {
    WampusIllegalOperationError,
    WampusInvocationCanceledError,
    WampusInvocationError, WampusIsolatedError,
    WampusNetworkError
} from "./types";
import {WampCancelOptions} from "../protocol/options";

export enum ErrorLevel {
    Transport = "Transport",
    Wamp = "Wamp"
}

export module Errs {

    export function unexpectedMessage(message: WampMessage.Any) {
        return new WampusNetworkError("Received an unexpected message of type {msg.type}", {
            msg: message
        })
    }

    export function receivedProtocolViolation(source: WampType, error: WampMessage.Error) {
        return new WampusNetworkError("Protocol violation.", {
            level: "WAMP",
            error: error,
            source: WampType[source],
            code: WampUri.Error.ProtoViolation
        });
    }

    export function featureNotSupported(feature: string, msg ?: WampMessage.Any) {
        return new WampusIllegalOperationError("Feature not supported: {feature}.", {
            feature,
            msg
        });
    }

    export function routerDoesNotSupportFeature(feature : string, msg ?: WampMessage.Any) {
        return new WampusIllegalOperationError("The router doesn't support the feature: {feature}.", {
            feature,
            msg
        });
    }

    export function optionNotAllowed(operation : string, err: WampMessage.Error,) {
        return new WampusIllegalOperationError("While doing operation {operation}, received an OptionNotAllowed response.", {
            operation,
            err
        });
    }


    export module Handshake {
        export function unexpectedMessage(message: WampMessage.Any) {
            return new WampusNetworkError(
                `Protocol violation. During handshake, expected WELCOME or ERROR, but received: {type}`, {
                    type: WampType[message.type]
                }
            );
        }

        export function unrecognizedError(error: WampMessage.Abort) {
            return new WampusIllegalOperationError("During handshake, received ABORT reply from the server: {error}.", {
                error: error.reason,
                msg: error
            });
        }

        export function closed() {
            return new WampusNetworkError("Transport closed during handshake.", {});
        }

        export function noSuchRealm(realm: string) {
            return new WampusIllegalOperationError("Tried to join realm {realm}, but it did not exist, and the router refused to auto-create it.", {
                realm,
                code: WampUri.Error.NoSuchRealm
            });
        }
    }

    export module Unregister {
        export function registrationDoesntExist(name: string, err: WampMessage.Error) {
            return new WampusIllegalOperationError("Tried to unregister procedure {procedure}, but it didn't exist.", {
                procedure: name,
                err
            });
        }

        export function other(name: string, err: WampMessage.Error) {
            return new WampusIllegalOperationError("Tried to unregister procedure {procedure}, but received an ERROR response.", {
                procedure: name,
                err
            });
        }
    }

    export module Register {
        export function procedureAlreadyExists(name: string) {
            return new WampusIllegalOperationError("Tried to register procedure {name}, but it's already registered.", {
                name
            });
        }

        export function error(name: string, err: WampMessage.Error) {
            return new WampusIllegalOperationError("Tried to register procedure {name}, but recieved an ERROR response.", {
                err,
                name
            });
        }

        export function cannotSendResultTwice(name: string) {
            return new WampusIllegalOperationError("While invoking {name}, tried to send a result or error more than once.", {
                name
            });
        }

        export function doesNotSupportProgressOnSend(name: string) {
            return new WampusIllegalOperationError("While invoking {name}, tried to send a progress report but this call does not support progress reports.", {
                name
            })
        }

    }


    export module Subscribe {
        export function notAuthorized(name : string, err : WampMessage.Error) {
            return new WampusIllegalOperationError("You are not authorized to subscribe to the event {name}.", {
                name,
                err
            });
        }

        export function other(name : string, err : WampMessage.Any){
            return new WampusIllegalOperationError("Tried to subscribe to {name}, but received an ERROR response.", {
                name,
                err
            });
        }

    }



    export module Unsubscribe {
        export function subDoesntExist(msg: WampMessage.Error, event: string) {
            return new WampusIllegalOperationError("Failed to unsubscribe from event {event} because the subscription did not exist.", {
                msg,
                name: event
            });
        }

        export function other(msg: WampMessage.Error, event: string) {
            return new WampusIllegalOperationError("Tried to unsubscribe to the event {event}, but received an ERROR response.", {
                msg,
                event
            })
        }
    }

    export module Leave {
        export function networkErrorOnAbort(err: Error) {
            return new WampusNetworkError("While trying to ABORT, received a network error. Going to terminate connection anyway.", {
                innerError: err
            })
        }

        export function errorOnGoodbye(msg : WampMessage.Error ){
            return new WampusNetworkError("Tried to say GOODBYE, but received an ERROR response.", {
                msg
            });
        }

        export function unexpectedMessageOnGoodbye(msg : WampMessage.Any) {
            return new WampusNetworkError("Unexpected on goodbye.", {
                msg
            });
        }

        export function goodbyeTimedOut() {
            return new WampusNetworkError("Tried to say GOODBYE, but timed out before receiving GOODBYE response.");
        }

    }

    export module Invocation {
        export function cancelled() {
            return new WampusInvocationCanceledError("The invocation of procedure {name} was cancelled.", {

            });
        }
    }

    export module Call {
        export function noSuchProcedure(name: string) {
            return new WampusIllegalOperationError("Tried to call procedure {name}, but it did not exist.", {
                name,
                code: WampUri.Error.NoSuchProcedure
            });
        }

        export function resultReceivedBeforeCancel(name: string, result: WampMessage.Result) {
            return new WampusIsolatedError("While canceling operation {name}, received a RESULT instead of an ERROR. This indicates the call wasn't cancelled.", {
                name,
                level: "warning"
            });
        }

        export function noEligibleCallee(name: string) {
            return new WampusIllegalOperationError("This peer tried to call procedure {name} with exclusions, but no callee matching the exclusions was found.", {
                name,
                code: WampUri.Error.NoEligibleCallee
            });
        }

        export function errorResult(name: string, msg: WampMessage.Error) {
            return new WampusInvocationError(name, msg);
        }

        export function other(name : string, msg : WampMessage.Error) {
            return new WampusIllegalOperationError("Invoked procedure {name} and received an ERROR: {error}", {
                name,
                msg,
                error : msg.error
            });
        }

        export function invalidArgument(name: string, realm: string, message: string) {
            return new WampusIllegalOperationError("In realm {realm}, called procedure {name}, but the given arguments failed validation. This error may be thrown by the router or callee.", {
                name,
                realm,
                code: WampUri.Error.InvalidArgument
            });
        }

        export function optionDisallowedDiscloseMe(name: string) {
            return new WampusIllegalOperationError("The peer tried to call the procedure {name} with the disclose_me flag, but the router refused the flag.", {
                name,
                code: WampUri.Error.DisallowedDiscloseMe
            });
        }

        export function canceled(name: string) {
            return new WampusInvocationCanceledError("Called {name} successfuly, but the call was canceled before its result could be processed.", {
                name,
                code: WampUri.Error.Canceled
            });
        }

    }

    export function notAuthorized(operation: string, msg : WampMessage.Error) {
        return new WampusIllegalOperationError(`Tried to perform the operation: ${operation}, but received NOT AUTHORIZED.`, {
            msg,
            operation
        });
    }

    export function invalidUri(operation : string, msg : WampMessage.Error) {
        return new WampusIllegalOperationError(`Tried to perform operation: {operation}, but the call/event URI was invalid.`, {
            operation,
            msg
        })
    }

    export function networkFailure(operation : string, msg : WampMessage.Error) {
        return new WampusIllegalOperationError("Tried to perform operation {operation}, but received a network failure response.", {
            operation,
            msg
        });
    }

    export function sessionClosed(operation : string) {
        return new WampusNetworkError("Tried to perform {operation}, but the session was closed.");
    }
}

export module NetworkErrors {

    export module Handshake {
        export function unexpectedMessage(message: WampMessage.Any) {
            return new WampusNetworkError(
                `Protocol violation. During handshake, expected WELCOME or ERROR, but received: {type}`, {
                    type: WampType[message.type]
                }
            );
        }


        export function closed() {
            return new WampusNetworkError("Transport closed during handshake.", {});
        }
    }

    export function wampViolation(info: string, context: Record<string, any>) {
        return new WampusNetworkError("A WAMP protocol violation error occurred. More info: {info}.", {
            level: "WAMP",
            info,
            ...context,
            code: WampUri.Error.ProtoViolation
        });
    }


    export function networkFailure(IMPLEMENT: never) {

    }


}
export module IllegalOperations {




    export function procedureAlreadyExists(name: string, realm: string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to register operation {name}, but it's already registered.", {
            name,
            realm,
            code: WampUri.Error.ProcAlreadyExists
        });
    }


    export function noSuchSubscription(event: string, realm: string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to unsubscribe from event {event}, but the subscription did not exist. It may have already been closed.", {
            event,
            realm,
            code: WampUri.Error.NoSuchSubscription
        });
    }

    export function noSuchRegistration(name: string, realm: string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to unregister procedure {name}, but it wasn't registrered to this session.", {
            name,
            realm,
            code: WampUri.Error.NoSuchRegistration
        });
    }


    export function authFailed(IMPLEMENT: never) {

    }

    export function noSuchRole(role: string, realm: string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to authenticate under role {role}, but the role did not exist. This may indicate a problem in the router.", {
            role,
            realm,
            code: WampUri.Error.NoSuchRole
        });
    }


    export function optionNotAllowed(realm: string) {
        return new WampusIllegalOperationError("In realm {realm}, this peer requested an interaction that was disallowed by the router.", {
            realm,
            code: WampUri.Error.OptionNotAllowed
        });
    }


    export function noSuchSession(session: number | string, realm: string) {
        return new WampusIllegalOperationError("In realm {realm}, tried to get information about session {session}, but it did not exist.", {
            session,
            realm,
            code: WampUri.Error.ProtoViolation
        })
    }
}