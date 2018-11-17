import {WampArray, WampMessage, WampPrimitive} from "../protocol/messages";
import {WampType} from "../protocol/message.type";
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
 * A route registration.
 */
export type PrefixRoute<T> = {
	/**
	 * The prefix key for matching the route.
	 */
	readonly key : WampPrimitive[];

	/**
	 * Used to notify a route a message matching its key has been received.
	 * @param x The argument.
	 */
    next?(x: T): void;

	/**
	 * Notifies a route it should complete.
	 */
	complete?() : void;

	/**
	 * Notifies a route it should error.
	 * @param err The error to error with.
	 */
    error?(err : Error) : void;
}

/**
 * A recursive data structure containing a bucket of routes, and a dictionary of route indexes by key element value.
 * Used to invoke routes matching a key.
 */
interface RouteIndex<T> {
	/**
	 * The bucket of routes matching the key so far.
	 */
    match?: PrefixRoute<T>[];

	/**
	 * A dictionary of route indexes based on the next key component.
	 */
	next?: Map<any, RouteIndex<T>>;
}

/**
 * A component that routes WAMP protocol messages to code that expects them.
 */
export class PrefixRouter<T> {
    private _root: RouteIndex<T> = null;

	/**
	 * Returns the total number of registered routes.
	 */
	count() {
        if (!this._root) return 0;
        let rec = (x : RouteIndex<T>) => {
            return x.match.length + Array.from(x.next.values()).reduce((tot, cur) => tot + rec(cur), 0);
        };
        return rec(this._root);
    }

	/**
	 * Returns all routes.
	 */
	matchAll() {
        return this.reverseMatch([]);
    }

	/**
	 * Matches routes where the given key is a prefix of the route's key. Reverse matching.
	 * @param key The given key to match against the routes.
	 */
	reverseMatch(key : WampPrimitive[]) {
        let routes = [];
        function rec(cur : RouteIndex<T>, index : number) {
            if (!cur) return;
            if (index >= key.length) {
                routes.push(...cur.match);
                [...cur.next.values()].forEach(next => rec(next, index + 1));
            } else {
                let next = cur.next.get(key[index]);
                if (next) {
                    rec(next, index + 1);
                }
            }
        }
        rec(this._root, 0);
        return routes;
    }

	/**
	 * Matches all routes where the route's key is a prefix of the given key.
	 * @param keys
	 */
	match(keys: WampPrimitive[]) {
        if (keys[0] === WampType.INVOCATION) {
            //ugly but works
            let a = keys[2];
            keys[2] = keys[1];
            keys[1] = a;
        }
        let routes = [] as PrefixRoute<T>[];
        let rec = function (cur: RouteIndex<T>, index: number) {
            if (!cur) return;
            for (let target of cur.match) {
                routes.push(target);
            }
            if (index >= keys.length) {

                return;
            }
            let next = cur.next.get(keys[index]);
            if (!next) return cur;
            rec(next, index + 1);
        };
        rec(this._root, 0);
        return routes;
    }

	/**
	 * Inserts route into the router.
	 * @param target The prefix route.
	 */
	insertRoute(target: PrefixRoute<T>) {
        let keys = target.key;
        _.defaults(target, {
            error() {},
            next() {},
            complete() {}
        });
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
     * Removes a route from the internal index. Note that this won't do anything to the route object itself, so it may still expect input.
     * @param target The route to remove, by reference.
     */
    removeRoute(target: PrefixRoute<T>) {
        let keys = target.key;
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