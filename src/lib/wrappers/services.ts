import {WampObject} from "../core/protocol/messages";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import {InvocationTicket} from "./tickets/invocation-ticket";
import {CallTicket} from "./tickets/call";
import CallSite = NodeJS.CallSite;
import {Transformation, Transformer} from "./services/recursive-transform";

export class TransformSet {
	objectToJson = new  Transformer<any, WampObject>();

	jsonToObject = new Transformer<WampObject, any>();

	errorResponseToError = new Transformer<WampusInvocationError, Error>();

	errorToErrorResponse = new Transformer<{error : Error, source : InvocationTicket}, WampusSendErrorArguments>();
}


export type StackTraceService = {
    enabled : boolean;
    capture(ctor : Function): CallSite[];
    format(err : Error, callSites: CallSite[]): string;
};

export type JsonToRuntimeObject = Transformation<WampObject, any>;
export type RuntimeObjectToJson = Transformation<any, WampObject>;
export type ResponseToRuntimeError = Transformation<WampusInvocationError, Error>;
export type RuntimeErrorToResponse = Transformation<Error, WampusSendErrorArguments>;

export interface AbstractWampusSessionServices {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}




