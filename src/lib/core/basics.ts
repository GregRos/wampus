import {WampArray, WampObject} from "./protocol/messages";

export interface WampResult {
    args?: WampArray;
    kwargs?: WampObject;
}

export interface WampError extends WampResult {

    readonly args?: WampArray;

    readonly kwargs?: WampObject;

    readonly error: string;
}