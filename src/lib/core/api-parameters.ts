import {WampArray, WampMessage, WampObject, WampUriString} from "../protocol/messages";
import {
    WampCallOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampResultOptions,
    WampSubscribeOptions, WampYieldOptions
} from "../protocol/options";
import CallSite = NodeJS.CallSite;

export interface WampusCallArguments {
    name: string;
    options?: WampCallOptions;
    args?: WampArray;
    kwargs?: WampObject;
}

export interface WampusPublishArguments {
    name: string;
    options?: WampPublishOptions;
    args?: WampArray;
    kwargs?: WampObject;
}

export interface WampusSendResultArguments {
    kwargs?: WampObject;
    args?: WampArray;
    options: WampYieldOptions;
}

export interface WampusReceiveResultArguments {
    kwargs : WampObject;
    args : WampArray;
    options : WampResultOptions
}

export interface WampusSendErrorArguments {
    args?: WampArray;
    kwargs?: WampObject;
    reason?: WampUriString;
    options?: WampObject;
}

export interface WampusReceiveErrorArguments {
    args : WampArray;
    kwargs : WampObject;
    reason : WampUriString;
    options ?: WampObject;
}

export interface WampusSubcribeArguments {
    options?: WampSubscribeOptions;
    event: string;
}

export interface WampusRegisterArguments {
    options?: WampRegisterOptions;
    procedure: string;
}

export interface TransformSet {
    objectToJson ?: RuntimeObjectToJson;

    jsonToObject ?: JsonToRuntimeObject;

    errorResponseToError ?: ResponseToRuntimeError;

    errorToErrorResponse ?: RuntimeErrorToResponse;
}

export type StackTraceService = {
    capture() : CallSite[];
    format(callSites : CallSite[]) : string;
};

export type JsonToRuntimeObject = (json : WampObject, ctx ?: TransformSet) => any;

export type RuntimeObjectToJson = (obj : any, ctx ?: TransformSet) => WampObject;

export type ResponseToRuntimeError = (error : WampMessage.Error, ctx ?: TransformSet) => Error;

export type RuntimeErrorToResponse = (error : Error) => WampusSendErrorArguments;

