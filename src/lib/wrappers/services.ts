import {WampObject} from "../core/protocol/messages";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import {WampusInvocationError} from "../core/errors/types";
import {ProcedureInvocationTicket} from "./tickets/procedure-invocation";
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

export type JsonToRuntimeObject = (services : WampusSessionServices, json: WampObject) => any;
export type RuntimeObjectToJson = (services : WampusSessionServices, obj: any) => WampObject;
export type ResponseToRuntimeError = (services : WampusSessionServices, source : CallTicket, error : WampusInvocationError) => Error;

export interface AbstractWampusSessionServices {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}

export type RuntimeErrorToResponse = (services : WampusSessionServices, source : ProcedureInvocationTicket, error: Error) => WampusSendErrorArguments;

export class WampusSessionServices {

    constructor(private _services : AbstractWampusSessionServices) {

    }

    stackTraceService = {
        enabled : () => {
            return this._services.stackTraceService.enabled;
        },
        capture : (ctor : Function) => {
            if (!this._services.stackTraceService.enabled) return null;
            return this._services.stackTraceService.capture(ctor);
        },
        format : (err : Error, callSites : CallSite[]) => {
            return this._services.stackTraceService.format(err, callSites);
        },
        embedTrace : (target : Error, trace : CallSite[]) => {
            if (!trace) return;
            target.stack = this.stackTraceService.format(target, trace);
        }
    };

    transforms = {
        objectToJson : (obj : any) => {
            return this._services.transforms.objectToJson(this, obj);
        },
        jsonToObject : (json : WampObject) => {
            return this._services.transforms.jsonToObject(this, json);
        },
        errorResponseToError : (call : CallTicket, error : WampusInvocationError) => {
            return this._services.transforms.errorResponseToError(this, call, error);
        },
        errorToErrorResponse : (invocation : ProcedureInvocationTicket, error : Error) => {
            return this._services.transforms.errorToErrorResponse(this, invocation, error);
        }
    };
}



