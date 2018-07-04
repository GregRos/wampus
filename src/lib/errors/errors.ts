import {WampUri} from "../proto/uris";
import {WampMsgType} from "../proto/message.type";
import {WampMessage} from "../proto/messages";
import {WampusIllegalOperationError, WampusInvocationCanceledError, WampusNetworkError} from "./types";

export enum ErrorLevel {
    Transport = "Transport",
    Wamp = "Wamp"
}

export module Errs {

    export function unexpectedMessage(message : WampMessage.Any) {
        return new WampusNetworkError("Received an unexpected message of type {msg.type}", {
            msg : message
        })
    }

    export function receivedProtocolViolation(source : WampMsgType, error : WampMessage.Error) {
        return new WampusNetworkError("Protocol violation.", {
            level: "WAMP",
            error : error,
            source : WampMsgType[source],
            code: WampUri.Error.ProtoViolation
        });
    }

    export function featureNotSupported(message : WampMessage.Any, feature : string) {
        return new WampusIllegalOperationError("Feature not supported: {feature}.", {
            feature,
            message
        });
    }


    export module Handshake {
        export function unexpectedMessage(message: WampMessage.Any) {
            return new WampusNetworkError(
                `Protocol violation. During handshake, expected WELCOME or ERROR, but received: {type}`, {
                    type: WampMsgType[message.type]
                }
            );
        }

        export function unrecognizedError(error : WampMessage.Error) {
            return new WampusIllegalOperationError("During handshake, received ERROR reply from the server: {error}.", {
                error : error.error,
                message : error
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

    export module Call {
        export function noSuchProcedure(name: string) {
            return new WampusIllegalOperationError("Tried to call procedure {name}, but it did not exist.", {
                name,
                code: WampUri.Error.NoSuchProcedure
            });
        }

        export function noEligibleCallee(name: string) {
            return new WampusIllegalOperationError("This peer tried to call procedure {name} with exclusions, but no callee matching the exclusions was found.", {
                name,
                code: WampUri.Error.NoEligibleCallee
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
}

export module NetworkErrors {

    export module Handshake {
        export function unexpectedMessage(message: WampMessage.Any) {
            return new WampusNetworkError(
                `Protocol violation. During handshake, expected WELCOME or ERROR, but received: {type}`, {
                    type: WampMsgType[message.type]
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


    export function notAuthorized(operation: string, realm: string) {
        return new WampusIllegalOperationError("In realm {realm}, this session is not authorized to perform the specified operation: {operation}", {
            operation,
            realm,
            code: WampUri.Error.NotAuthorized
        });
    }

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