import {WampArray, WampMessage, WampObject} from "../../protocol/messages";
import {WampEventOptions, WampInvocationOptions, WampResultOptions} from "../../protocol/options";
import {WampusSendErrorArguments, WampusSendResultArguments} from "../api-parameters";
import {Observable} from "rxjs";
import {WampMessenger} from "../messaging/wamp-messenger";

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

export interface InterruptRequest {
    received : Date;
    options : any;
    message : WampMessage.Interrupt;
}

export interface AbstractInvocationRequest {

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly options: WampInvocationOptions;

    readonly name: string;

    readonly requestId : number;

    readonly isHandled : boolean;

    return(args: WampusSendResultArguments): Promise<void>;

    progress(args : WampusSendResultArguments) : Promise<void>;

    error({args, options, kwargs, error}: WampusSendErrorArguments): Promise<void>;

    interruptSignal : Observable<InterruptRequest>;
}