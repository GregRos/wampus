import {Wamp, WampType} from "typed-wamp";
import {
    WampusIllegalOperationError,
    WampusInvocationCanceledError,
    WampusInvocationError,
    WampusNetworkError
} from "./types";

import WM = Wamp;

/**
 * Returns only the error information properties from an Error message.
 * @param err
 */
function getWampErrorReplyBasedMembers(err: Wamp.Error) {
    let members = {} as any;

    members._originalWampMessage = err;
    members.error = err.error;
    members.details = err.details;
    if ("args" in err) {
        members.args = err.args;
    }
    if ("kwargs" in err) {
        members.kwargs = err.kwargs;
    }


    return members;
}

/**
 * Returns the error information properties from an ABORT message.
 * @param abort The ABORT message.
 */
function getWampAbortBasedMembers(abort: Wamp.Abort) {
    let members = {
        _originalWampMessage: abort,
        details: abort.details,
        reason: abort.reason
    };
    return members;
}


function getDescriptionByMessage(source: WM.Any) {
    if (source instanceof WM.Authenticate) {
        return "authenticating";
    } else if (source instanceof WM.Call) {
        return `calling procedure ${source.procedure}`;
    } else if (source instanceof WM.Publish) {
        return `publishing topic ${source.topic}`;
    } else if (source instanceof WM.Register) {
        return `registering procedure ${source.procedure}`;
    } else if (source instanceof WM.Subscribe) {
        return `subscribing to topic ${source.topic}`;
    } else if (source instanceof WM.Unregister) {
        return `unregistering from procedure`;
    } else if (source instanceof WM.Unsubscribe) {
        return `unsubscribing from topic`;
    } else if (source instanceof WM.Yield) {
        return `yielding response`;
    } else if (source instanceof WM.Cancel) {
        return `cancelling invocation`;
    } else if (source instanceof WM.Error) {
        return `sending error response`;
    } else if (source instanceof WM.Hello) {
        return `beginning handshake`;
    } else if (source instanceof WM.Goodbye) {
        return `saying goodbye`;
    }
}

// tslint:disable:completed-docs

export namespace Errs {

    export function receivedProtocolViolation(source: WM.Any, error: Wamp.Abort) {
        return new WampusNetworkError("Received protocol violation during handshake.", getWampAbortBasedMembers(error));
    }

    export function routerDoesNotSupportFeature(source: WM.Any, feature: string) {
        let operation = getDescriptionByMessage(source);
        return new WampusIllegalOperationError(`While ${operation}, tried to use the advanced profile feature ${feature}, but it was not supported.`, {});
    }

    export function optionNotAllowed(source: Wamp.Any, err: Wamp.Error) {
        let operation = getDescriptionByMessage(source);

        return new WampusIllegalOperationError(`While ${operation}, one of the options was not allowed.`, getWampErrorReplyBasedMembers(err));
    }

    export function sessionIsClosing(source: WM.Any) {
        let operation = getDescriptionByMessage(source);
        return new WampusNetworkError(`While ${operation}, the session was closed.`, {});
    }

    export namespace Handshake {

        export function noAuthenticator(challenge: Wamp.Challenge) {
            return new WampusNetworkError("During handshake, the router sent a CHALLENGE authentication message, but no authenticator was configured.", {
                sourceMsg: challenge
            });
        }

        export function unexpectedMessage(message: Wamp.Any) {
            let tp = WampType[message.type];
            return new WampusNetworkError(
                `During handshake, expected WELCOME, ABORT, or CHALLENGE, but received an invalid message of type ${tp}. `, {
                    unexpectedMessage: message
                }
            );
        }

        export function unrecognizedError(abort: Wamp.Abort) {
            return new WampusIllegalOperationError(`During handshake, the router sent an ABORT reply (${abort.reason}).`, getWampAbortBasedMembers(abort));
        }

        export function closed() {
            return new WampusNetworkError(`During handshake, the transport abruptly closed.`, {});
        }

        export function noSuchRealm(realm: string, msg: Wamp.Abort) {
            return new WampusIllegalOperationError(`Tried to join realm ${realm}, but it did not exist (${msg.reason}).`, getWampAbortBasedMembers(msg));
        }
    }

    export namespace Unregister {
        export function registrationDoesntExist(procedure: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`Tried to unregister procedure ${procedure}, but the registration did not exist. This is probably a bug. Going to assume it has been closed.`, getWampErrorReplyBasedMembers(err));
        }

        export function other(name: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`Tried to unregister procedure ${name}, but received an ERROR response (${err.error}).`, getWampErrorReplyBasedMembers(err));
        }
    }

    export namespace Register {
        export function procedureAlreadyExists(name: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`Tried to register procedure ${name}, but a procedure with this name is already registered.`, getWampErrorReplyBasedMembers(err));
        }

        export function error(name: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`Tried to register procedure ${name}, but recieved an ERROR response (${err.error}).`, getWampErrorReplyBasedMembers(err));
        }

        export function cannotSendResultTwice(name: string) {
            return new WampusIllegalOperationError(`While executing procedure ${name}, tried to yield a response or error, but the final response has already been sent.`, {});
        }

        export function doesNotSupportProgressReports(name: string) {
            return new WampusIllegalOperationError(`While executing procedure ${name}, tried to send a progress report but this call does not support progress reports.`, {});
        }

        export function resultIncorrectFormat(name: string, obj: any) {
            return new WampusIllegalOperationError(`While executing procedure ${name}, tried to yield an incorrectly structured response.`, {
                result: obj
            });
        }

    }


    export namespace Subscribe {
        export function other(name: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`Tried to subscribe to ${name}, but received an ERROR response (${err.error}).`, getWampErrorReplyBasedMembers(err));
        }

    }


    export namespace Unsubscribe {
        export function subDoesntExist(msg: Wamp.Error, event: string) {
            return new WampusIllegalOperationError(`Tried to unsubscribe from ${event}, but the subscription did not exist. This is probably a bug. Going to assume the subscription is closed.`,
                getWampErrorReplyBasedMembers(msg)
            );
        }

        export function other(msg: Wamp.Error, event: string) {
            return new WampusIllegalOperationError(`Tried to unsubscribe from the topic ${event}, but received an ERROR response (${msg.error}).`, getWampErrorReplyBasedMembers(msg));
        }
    }

    export namespace Leave {
        export function networkErrorOnAbort(err: WampusNetworkError) {
            return new WampusNetworkError("While trying to ABORT, received a network error. Going to terminate connection anyway.", {
                innerError: err
            });
        }


        export function goodbyeTimedOut() {
            return new WampusNetworkError("While saying GOODBYE, timed out waiting for the router's response.");
        }

    }

    export namespace Publish {
        export function unknown(topic: string, err: WM.Error) {
            return new WampusIllegalOperationError(`Tried to publish topic ${topic}, but received an error response (${err.error})`, getWampErrorReplyBasedMembers(err));
        }
    }

    export namespace Call {
        export function noSuchProcedure(name: string, err: WM.Error) {
            return new WampusIllegalOperationError(`Tried to call procedure ${name}, but it did not exist.`, getWampErrorReplyBasedMembers(err));
        }

        export function noEligibleCallee(name: string, err: WM.Error) {
            return new WampusIllegalOperationError(`Tried to call procedure ${name} with exclusions, but no eligible callee was found.`,
                getWampErrorReplyBasedMembers(err)
            );
        }

        export function errorResult(name: string, err: Wamp.Error) {
            return new WampusInvocationError(`Called procedure ${name}, the callee replied with an error (${err.error})`, getWampErrorReplyBasedMembers(err));
        }

        export function other(name: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`While calling procedure ${name}, received an error response (${err.error})`, getWampErrorReplyBasedMembers(err));
        }

        export function invalidArgument(name: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`While calling procedure ${name}, one of the arguments was invalid.`, getWampErrorReplyBasedMembers(err));
        }

        export function optionDisallowedDiscloseMe(name: string, err: Wamp.Error) {
            return new WampusIllegalOperationError(`Tried calling procedure ${name} with the disclose_me option, but it was denied.`,
                getWampErrorReplyBasedMembers(err)
            );
        }

        export function canceled(name: string, err: Wamp.Error) {
            return new WampusInvocationCanceledError(`While calling the procedure ${name}, the call was cancelled.`, {});
        }

    }

    export function notAuthorized(source: Wamp.Any, msg: Wamp.Error) {
        let operation = getDescriptionByMessage(source);
        return new WampusIllegalOperationError(`While ${operation}, received a not authorized error.`, getWampErrorReplyBasedMembers(msg));
    }

    export function invalidUri(source: WM.Any, msg: Wamp.Error) {
        let operation = getDescriptionByMessage(source);
        return new WampusIllegalOperationError(`While ${operation}, the URI was invalid.`, getWampErrorReplyBasedMembers(msg));
    }

    export function networkFailure(source: WM.Any, msg: Wamp.Error) {
        let operation = getDescriptionByMessage(source);
        return new WampusNetworkError(`While ${operation}, received a network failure response`, getWampErrorReplyBasedMembers(msg));
    }

    export function sessionClosed(source: WM.Any) {
        let operation = getDescriptionByMessage(source);
        return new WampusNetworkError(`Tried ${operation}, but the session was already closed.`, {});
    }
}