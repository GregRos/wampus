import {WampObject} from "../core/protocol/messages";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import {InvocationTicket} from "./tickets/invocation-ticket";
import {CallTicket} from "./tickets/call";
import CallSite = NodeJS.CallSite;

export interface TransformSet {
    objectToJson?: RuntimeObjectToJson;

    jsonToObject?: JsonToRuntimeObject;

    errorResponseToError?: ResponseToRuntimeError;

    errorToErrorResponse?: RuntimeErrorToResponse;
}

export type StackTraceService = {
    enabled : boolean;
    capture(ctor : Function): CallSite[];
    format(err : Error, callSites: CallSite[]): string;
};

export type JsonToRuntimeObject = (json: WampObject) => any;
export type RuntimeObjectToJson = (obj: any) => WampObject;
export type ResponseToRuntimeError = (source : CallTicket, error : WampusInvocationError) => Error;
export type RuntimeErrorToResponse = (source : InvocationTicket, error: Error) => WampusSendErrorArguments;

export interface AbstractWampusSessionServices {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}




