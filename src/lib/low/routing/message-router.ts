import {WampMessage} from "../wamp/messages";
import most = require("most");
import {WampType} from "../wamp/message.type";



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
 *
 * The Stream exposed by the router is very elegantly composable into other streams.
 */

/**
 * A function that returns true if the route is considered "handled" and should be removed.
 */
export type RouteTarget<T> = (x: T) => void;

interface RouteIndex<T> {
    match?: RouteTarget<T>[];
    next?: Map<any, RouteIndex<T>>;
}


/**
 * A component that routes WAMP protocol messages to code that expects them.
 */
export class MessageRouter<T> {
    private _root: RouteIndex<T> = null;


    /**
     * Returns an observable that, when subscribed, will create a route for a sequence of keys.
     *
     * @param keys
     * @returns {Stream<T>}
     */
    expect(...keys: any[]) {
        /*
         An optimization can be achieved if some handlers are defined as one-time and are auto-removed once they are invoked
        This will mean the data structure will only need to be traversed once.
        */
        return new most.Stream<T>({
            run: (sink, sch) => {
                let inv = x => {
                    try {
                        // The event hander of a sink can throw an error.
                        sink.event(sch.now(), x);
                    }
                    catch (err) {
                        sink.error(sch.now(), err);
                    }
                };
                this._insertRoute(keys, inv);
                return {
                    dispose: () => {
                        this._removeRoute(keys, inv);
                    }
                }
            }
        });
    }

    push(keys: any[], object: T) {
        let anyMatches = false;
        if (keys[0] === WampType.INVOCATION) {
            //ugly but works
            let a = keys[2];
            keys[2] = keys[1];
            keys[1] = a;
        }
        let rec = (cur: RouteIndex<T>, index: number) => {
            if (!cur) return;
            if (cur.match.length > 0) {
                anyMatches = true;
            }
            cur.match.forEach(target => {
                target(object);
            });
            if (index >= keys.length) return;
            let next = cur.next.get(keys[index]);
            if (!next) return cur;
            rec(next, index + 1);
        };
        rec(this._root, 0);
        return anyMatches;
    }

    broadcast(object: T) {
        let rec = (cur: RouteIndex<T>) => {
            if (!cur) return;
            cur.match.forEach(f => f(object));
            for (let [k, v] of cur.next) {
                rec(v);
            }
        };
        rec(this._root);
    }

    reset() {
        this._root = null;
    }

    private _insertRoute(keys: any[], target: RouteTarget<T>) {
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
            return nextIndex;
        };
        this._root = rec(this._root, 0);
    }

    /**
     * Do not call this method except as part of `.expect`. If you remove a route, that will still leave some Streams expecting that route to be called dangling.
     * To properly remove a route, make sure the Stream that depends on it will complete or error.
     */
    private _removeRoute(keys: any[], target: RouteTarget<T>) {
        let rec = (cur: RouteIndex<T>, index: number) => {
            if (!cur) return null;
            if (keys.length <= index) {
                let foundIndex = cur.match.indexOf(target);
                if (foundIndex === -1) return cur;
                cur.match.splice(index, 1);
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
            }
            return cur;
        };
    }
}