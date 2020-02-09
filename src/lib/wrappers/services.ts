import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import CallSite = NodeJS.CallSite;
import {Transcurse, transcurse} from "transcurse";

/**
 * A set of standard transformations used by Wampus.
 */
export class TransformSet {
    out = {
        json: transcurse(),
        error: transcurse<Error, WampusSendErrorArguments>()
    };

    in = {
        json: transcurse<any, any>(),
        error: transcurse<WampusInvocationError, Error>()
    };

}

/**
 * An object used to capture stack traces, in order to help with debugging async calls.
 */
export interface StackTraceService {
    enabled: boolean;

    capture(ctor: Function): CallSite[];

    format(err: Error, callSites: CallSite[]): string;
}

export function createServices(): AbstractWampusSessionServices {
    return {
        out : {
            json: transcurse(),
            error: transcurse<Error, WampusSendErrorArguments>()
        },
        in: {
            json: transcurse<any, any>(),
            error: transcurse<WampusInvocationError, Error>()
        }
    };
}

/**
 * A set of services used by this Wampus session.
 */
export interface AbstractWampusSessionServices {
    out: {
        json: Transcurse,
        error: Transcurse<Error, WampusSendErrorArguments>
    };
    in: {
        json: Transcurse;
        error: Transcurse<WampusInvocationError, Error>
    };
    stackTraceService?: StackTraceService;
}
