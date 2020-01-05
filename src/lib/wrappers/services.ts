import {WampObject} from "typed-wamp";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import {StepByStepTransformer, TransformStep} from "./services/recursive-transform";
import CallSite = NodeJS.CallSite;

/**
 * A set of standard transformations used by Wampus.
 */
export class TransformSet {
    objectToJson = new StepByStepTransformer<any, any>();

    jsonToObject = new StepByStepTransformer<any, any>();

    errorResponseToError = new StepByStepTransformer<WampusInvocationError, Error>();

    errorToErrorResponse = new StepByStepTransformer<Error, WampusSendErrorArguments>();
}

/**
 * An object used to capture stack traces, in order to help with debugging async calls.
 */
export interface StackTraceService {
    enabled: boolean;
    capture(ctor: Function): CallSite[];
    format(err: Error, callSites: CallSite[]): string;
}

/**
 * A set of services used by this Wampus session.
 */
export interface AbstractWampusSessionServices {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}

