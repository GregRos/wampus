import {WampType} from "./message.type";

/**
 * A set of prefix key routes used to identify common routes messages.
 * @see [WAMP Basic Profile]{@link https://wamp-proto.org/static/rfc/draft-oberstet-hybi-crossbar-wamp.html#message-definitions}
 * @see [WAMP Advanced Profile]{@link https://wamp-proto.org/static/rfc/draft-oberstet-hybi-crossbar-wamp.html#rfc.section.14.1.1}
 */
export module Routes {

    export const goodbye = [WampType.GOODBYE];

    export const abort = [WampType.ABORT];

    export function error(type: WampType, param2 ?: number) {
        return param2 != null ? [WampType.ERROR, type, param2] : [WampType.ERROR, type];
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

    export function unregistered(unregisterReqId: number) {
        return [WampType.UNREGISTERED, unregisterReqId];
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