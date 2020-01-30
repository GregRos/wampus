import {WampObject} from "typed-wamp";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import {StepByStepTransformer, TransformStep} from "./services/recursive-transform";
import CallSite = NodeJS.CallSite;

/**
 * A set of standard transformations used by Wampus.
 */
export class TransformSet {
    out = {
        json: new StepByStepTransformer<any, any>(),
        error: new StepByStepTransformer<Error, WampusSendErrorArguments>()
    };

    in = {
        json: new StepByStepTransformer<any, any>(),
        error: new StepByStepTransformer<WampusInvocationError, Error>()
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
        out: {
            json: new StepByStepTransformer<any, any>(),
            error: new StepByStepTransformer<Error, WampusSendErrorArguments>()
        },
        in: {
            json: new StepByStepTransformer<any, any>(),
            error: new StepByStepTransformer<WampusInvocationError, Error>()
        }
    };
}

/**
 * A set of services used by this Wampus session.
 */
export interface AbstractWampusSessionServices {
    out: {
        json: StepByStepTransformer<any, any>,
        error: StepByStepTransformer<Error, WampusSendErrorArguments>
    };
    in: {
        json: StepByStepTransformer<any, any>;
        error: StepByStepTransformer<WampusInvocationError, Error>
    };
    stackTraceService?: StackTraceService;
}