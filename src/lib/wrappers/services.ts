import {WampObject} from "typed-wamp";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import {StepByStepTransformer, TransformStep} from "./services/recursive-transform";
import CallSite = NodeJS.CallSite;

export class TransformSet {
    objectToJson = new StepByStepTransformer<any, any>();

    jsonToObject = new StepByStepTransformer<any, any>();

    errorResponseToError = new StepByStepTransformer<WampusInvocationError, Error>();

    errorToErrorResponse = new StepByStepTransformer<Error, WampusSendErrorArguments>();
}


export interface StackTraceService {
    enabled: boolean;
    capture(ctor: Function): CallSite[];
    format(err: Error, callSites: CallSite[]): string;
}

export interface AbstractWampusSessionServices {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}

