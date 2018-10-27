import {WampMessage, WampObject} from "../core/protocol/messages";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import CallSite = NodeJS.CallSite;
import {WampusInvocationError} from "../core/errors/types";
import {WampUri} from "../core/protocol/uris";
import _ = require("lodash");
import {ProcedureInvocationTicket} from "./tickets/procedure-invocation";
import {WampusSessionServices} from "./wampus-session";
export interface TransformSet {
    objectToJson?: RuntimeObjectToJson;

    jsonToObject?: JsonToRuntimeObject;

    errorResponseToError?: ResponseToRuntimeError;

    errorToErrorResponse?: RuntimeErrorToResponse;
}

export type StackTraceService = {
    capture(ctor : Function): CallSite[];
    format(err : Error, callSites: CallSite[]): string;
};
export type JsonToRuntimeObject = (json: WampObject) => any;
export type RuntimeObjectToJson = (obj: any) => WampObject;
export type ResponseToRuntimeError = (error : WampusInvocationError) => Error;
export type RuntimeErrorToResponse = (services : WampusSessionServices, source : ProcedureInvocationTicket,error: Error) => WampusSendErrorArguments;

export const defaultTransformSet : TransformSet = {
    errorResponseToError(res) {
        return res;
    },
    objectToJson(obj) {
        return _.clone(obj);
    },
    errorToErrorResponse(services,source, err) {
        err.stack = err.stack + "\nSOURCE" + services.stackTraceService.format("" as any, source.source.trace.created);
        return {
            args : [],
            error : WampUri.Error.RuntimeError,
            options : {
                message : err.message
            },
            kwargs : _.pick(err, ["message", "name", "stack"])
        };
    },
    jsonToObject(js) {
        return js;
    }
};

export const defaultStackService : StackTraceService = {
    format(err,cs : CallSite[]) {
        let formatter = Error.prepareStackTrace;
        if (!formatter) {
            return cs.map(x => `   at ${x.getFunctionName()} (${x.getFileName()}:${x.getLineNumber()}:${x.getColumnNumber()}`).join("\n");
        } else {
            return formatter.call(Error, err, cs);
        }
    },
    capture(ctor) {
        if ("stackTraceLimit" in Error) {
            const origTrace = Error.prepareStackTrace;
            Error.prepareStackTrace = (err, stack) => ({err, stack});
            let obj = {stack : null};
            Error.captureStackTrace(obj, ctor);
            let {stack,err} = obj.stack as any;
            Error.prepareStackTrace = origTrace;
            return stack;
        }
        return null;
    }
};