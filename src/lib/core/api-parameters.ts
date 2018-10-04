import {WampArray, WampObject, WampUriString} from "../protocol/messages";
import {
    WampCallOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampResultOptions,
    WampSubscribeOptions,
    WampYieldOptions
} from "../protocol/options";

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
    options?: WampYieldOptions;
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

