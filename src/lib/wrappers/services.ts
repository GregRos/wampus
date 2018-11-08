import {WampObject} from "../core/protocol/messages";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import {InvocationTicket} from "./tickets/invocation-ticket";
import {CallTicket} from "./tickets/call";
import CallSite = NodeJS.CallSite;
import {TransformStep, StepByStepTransformer} from "./services/recursive-transform";

export class TransformSet {
	objectToJson = new  StepByStepTransformer<any, WampObject>();

	jsonToObject = new StepByStepTransformer<WampObject, any>();

	errorResponseToError = new StepByStepTransformer<WampusInvocationError, Error>();

	errorToErrorResponse = new StepByStepTransformer<{error : Error, source : InvocationTicket}, WampusSendErrorArguments>();
}


export type StackTraceService = {
    enabled : boolean;
    capture(ctor : Function): CallSite[];
    format(err : Error, callSites: CallSite[]): string;
};

export type JsonToRuntimeObject = TransformStep<WampObject, any>;
export type RuntimeObjectToJson = TransformStep<any, WampObject>;
export type ResponseToRuntimeError = TransformStep<WampusInvocationError, Error>;
export type RuntimeErrorToResponse = TransformStep<Error, WampusSendErrorArguments>;

export interface AbstractWampusSessionServices {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}




