import {WampType} from "../wamp/message.type";

export module Routes {
    export const goodbye = [WampType.GOODBYE];

    export function error(type: WampType, param2 ?: number) {
        return param2 ? [WampType.ERROR, type, param2] : [type];
    }

    export function published(publishReqId: number) {
        return [WampType.PUBLISHED, publishReqId];
    }

    export function subscribed(subReqId: number) {
        return [WampType.SUBSCRIBED, subReqId];
    }

    export function unsubscribed(unsubReqId: number) {
        return [WampType.UNSUBSCRIBED, unsubReqId];
    }

    export function event(subId: number) {
        return [WampType.EVENT, subId];
    }

    export function registered(registerReqId: number) {
        return [WampType.REGISTERED, registerReqId];
    }

    export function unregistered(registrationId: number) {
        return [WampType.UNREGISTERED, registrationId];
    }

    export function invocation(registrationId: number) {
        // NOTE: This isn't the actual order of the fields for an INVOCATION message.
        // The fields need to be reordered in this one special case. Indexes 1, 2 must be switched.
        return [WampType.INVOCATION, registrationId];
    }

    export function result(reqId: number) {
        return [WampType.RESULT, reqId];
    }
}