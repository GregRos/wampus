import {WampArray, WampObject} from "../wamp/messages";

export interface WampResult {
    args?: WampArray;
    kwargs?: WampObject;
}

export interface WampError {
    args?: WampArray;
    kwargs?: WampObject;
    reason: string;
}