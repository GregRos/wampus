import {WampArray, WampObject} from "./protocol/messages";

/**
 * Basic interface corresponding to a WAMP success or error result.
 */
export interface WampResult {
    args?: WampArray;
    kwargs?: WampObject;
}

/**
 * Interface corresponding to a WAMP error result.
 */
export interface WampError extends WampResult {

    readonly args?: WampArray;

    readonly kwargs?: WampObject;

    readonly error: string;
}