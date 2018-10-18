import {WampMessage, WampObject} from "../core/protocol/messages";
import {WampusSendErrorArguments} from "../core/session/message-arguments";
import CallSite = NodeJS.CallSite;
import {WampusInvocationError} from "../core/errors/types";
import {WampUri} from "../core/protocol/uris";
import _ = require("lodash");
export interface TransformSet {
    objectToJson?: RuntimeObjectToJson;

    jsonToObject?: JsonToRuntimeObject;

    errorResponseToError?: ResponseToRuntimeError;

    errorToErrorResponse?: RuntimeErrorToResponse;
}

export type StackTraceService = {
    capture(): CallSite[];
    format(callSites: CallSite[]): string;
};
export type JsonToRuntimeObject = (json: WampObject) => any;
export type RuntimeObjectToJson = (obj: any) => WampObject;
export type ResponseToRuntimeError = (error : WampusInvocationError) => Error;
export type RuntimeErrorToResponse = (error: Error) => WampusSendErrorArguments;

export const defaultTransformSet : TransformSet = {
    errorResponseToError(res) {
        return res;
    },
    objectToJson(obj) {
        return Object.assign({}, obj);
    },
    errorToErrorResponse(err) {
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
    format(cs : CallSite[]) {
        return cs.map(x => `   at ${x.getFunctionName()} (${x.getFileName()}:${x.getLineNumber()}:${x.getColumnNumber()}`).join("\n");
    },
    capture() {
        if ("stackTraceLimit" in Error) {
            const callsites = require("callsites");
            let existingStackTrace = callsites();
            return existingStackTrace;
        }
        return null;
    }
};