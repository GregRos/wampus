import {WampArray, WampMessage, WampPrimitive} from "../../../protocol/messages";
import {WampType} from "../../../protocol/message.type";
import _ = require("lodash");


/*
 * When an operation is invoked by the library, it will usually expect a specific message or messages in response.
 * However, the part that's processing messages isn't connected to the part that expects a specific message to arrive.
 * This object is the solution to that problem. It basically acts as a router for WAMP protocol messages to deliver them to their destinations.
 *
 * Each message can be routed using its parameters. The WAMP protocol makes it easy, as in all but one case a message can be routed using its initial fields in the array representation.
 * For example, if you receive the message [ERROR, CALL, 551, ...], we know that this is an ERROR response to a CALL message with ID 551.
 *
 * (The odd case is the INVOCATION message, which goes [INVOCATION, requestId, registration, ...], but to route it you need [INVOCATION, registration] and not the requestId.
 * This is solved with a hardcoded special case)
 *
 * So when a CALL message is sent, the code sending the message will request a route for [ERROR, CALL, 551] and one for [RESULT, 551]. The CALL message must have one of either reply.
 * The route takes the form of a handler that's stored in the RouteIndex data structure.

 * When the message [RESULT, 551, ...] arrives, the router will use its initial fields as keys in its map data structure, and find the handler set by the code that sent the CALL message.
 * That handler will be invoked.
 *
 * This structure is abstracted over well using Observables. When some code expects a message to arrive, it will use the `.expect` method with the expected message's keys. It receives a Stream
 * which, when subscribed, will fire every time a message matching the criteria arrives. When the caller closes a subscription, the handler embedded in the router will be removed.
 */

/**
 * A function that returns true if the route is considered "handled" and should be removed.
 */
export type MessageRoute<T> = {
    special ?: string;
    keys : WampArray;
    next?(x: T): void;
    complete?() : void;
    error?(err : Error) : void;
}

interface RouteIndex<T> {
    match?: MessageRoute<T>[];
    next?: Map<any, RouteIndex<T>>;
}

function setDefaults(target : MessageRoute<any>) {
    _.defaults(target, {
        error() {},
        next() {},
        complete() {}
    });

}

/**
 * A component that routes WAMP protocol messages to code that expects them.
 */
export class MessageRouter<T> {
    private _root: RouteIndex<T> = null;

    count() {
        let rec = (x : RouteIndex<T>) => {
            return x.match.length + Array.from(x.next.values()).reduce((tot, cur) => tot + rec(cur), 0);
        };
        return rec(this._root);
    }

    matchDefault() {
        if (this._root) {
            return this._root.match;
        } else {
            return [];
        }
    }

    matchAll() {
        return this.match([]);
    }

    match(keys: WampPrimitive[]) {
        if (keys[0] === WampType.INVOCATION) {
            //ugly but works
            let a = keys[2];
            keys[2] = keys[1];
            keys[1] = a;
        }
        let routes = [] as MessageRoute<T>[];
        let rec = function (cur: RouteIndex<T>, index: number) {
            if (!cur) return;
            for (let target of cur.match) {
                routes.push(target);
            }
            if (index >= keys.length) return;
            let next = cur.next.get(keys[index]);
            if (!next) return cur;
            rec(next, index + 1);
        };
        rec(this._root, 0);
        return routes;
    }

    insertRoute(target: MessageRoute<T>) {
        let keys = target.keys;
        setDefaults(target);
        let rec = (cur: RouteIndex<T>, index: number) => {
            if (!cur) {
                cur = {
                    match: [],
                    next: new Map()
                };
            }
            if (keys.length <= index) {
                cur.match.push(target);
                return cur;
            }
            let nextIndex = cur.next.get(keys[index]);
            nextIndex = rec(nextIndex, index + 1);
            cur.next.set(keys[index], nextIndex);
            return cur;
        };
        this._root = rec(this._root, 0);
    }

    /**
     * Do not call this method except as part of `.expect`. If you remove a route, that will still leave some Streams expecting that route to be called dangling.
     * To properly remove a route, make sure the Stream that depends on it will complete or error.
     */
    removeRoute(target: MessageRoute<T>) {
        let keys = target.keys;
        let rec = (cur: RouteIndex<T>, index: number) => {
            if (!cur) return null;
            if (keys.length <= index) {
                let foundIndex = cur.match.indexOf(target);
                if (foundIndex === -1) return cur;
                cur.match.splice(foundIndex, 1);
                if (cur.match.length === 0 && cur.next.size === 0) {
                    return null;
                } else {
                    return cur;
                }
            }
            let next = cur.next.get(keys[index]);
            if (!next) return cur;
            next = rec(next, index + 1);
            if (!next) {
                cur.next.delete(keys[index]);
            } else {
                cur.next.set(keys[index], next);
            }
            return cur;
        };
        this._root = rec(this._root, 0);
    }
}