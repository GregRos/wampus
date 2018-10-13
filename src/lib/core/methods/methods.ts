import {WampArray, WampObject} from "../../protocol/messages";
import {WampEventOptions, WampInvocationOptions, WampResultOptions} from "../../protocol/options";
import {WampusSendErrorArguments, WampusSendResultArguments} from "../api-parameters";
import {Observable} from "rxjs";

export interface WampResult {
    args: WampArray;
    kwargs: WampObject;
}

export interface WampError {
    args?: WampArray;
    kwargs?: WampObject;
    reason: string;
}

export interface AbstractCallResult extends WampResult {
    readonly name : string;

    readonly args : any[];

    readonly kwargs : any;

    readonly isProgress : boolean;

    readonly details : WampResultOptions;
}

export interface AbstractEventArgs {
    args: WampArray;
    kwargs: WampObject;
    details: WampEventOptions;
    name: string;
}

export interface AbstractInvocationRequest {

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly options: WampInvocationOptions;

    readonly name: string;

    readonly requestId : number;

    return(args: WampusSendResultArguments): Promise<void>;

    error({args, options, kwargs, reason}: WampusSendErrorArguments): Promise<void>;

    waitCancel(time: number): Promise<void>;
}