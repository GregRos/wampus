import {WampMessage} from "../proto/messages";
import most = require("most");

/**
 * A function that returns true if the route is considered "handled" and should be removed.
 */
export type RouteTarget<T> = (msg : T) => boolean;

interface RouteIndex<T> {
    match ?: RouteTarget<T>[];
    next ?: Map<any, RouteIndex<T>>;
}



export class MessageRouter<T> {
    private _root : RouteIndex<T> = null;

    insertRoute(keys : any[], target : RouteTarget<T>) {
        let rec = (cur : RouteIndex<T>, index : number) => {
            if (!cur) {
                cur = {
                    match : []
                };
            }
            if (keys.length <= index) {
                cur.match.push(target);
            }
            if (!cur.next) {
                cur.next = new Map();
            }
            let nextIndex = cur.next.get(keys[index]);
            nextIndex = rec(nextIndex, index + 1);
            cur.next.set(keys[index], nextIndex);

            return nextIndex;
        };
        this._root = rec(this._root, 0);
    }

    removeRoute(keys : any[], target : RouteTarget<T>) {
        let rec = (cur : RouteIndex<T>, index : number) => {
            if (!cur) return false;
            if (keys.length <= index) {
                let foundIndex = cur.match.indexOf(target);
                if (foundIndex === -1) return false;
                if (cur.match.length <= 1 && !cur.next) {
                    cur.match
                }
                cur.match.splice(index, 1);

            }
            if (cur.next){
                let next = cur.next.get(keys[index]);
                return rec(next, index + 1);
            }
            return false;
        };
    }


    waitRoute(keys : any[]) {
        return new most.Stream({
            run(sunk, sch) {

            }
        })
    }

    match(keys : any[], object : T) {
        let anyMatches = false;
        let rec = (cur : RouteIndex<T>, index : number) => {
            if (!cur) return;
            if (cur.match.length > 0) {
                anyMatches = true;
            }
            cur.match = cur.match.filter(rt => !rt(object));
            if (cur.next) {
                let next = cur.next.get(keys[index]);
                rec(next, index + 1);
            }
        };
        rec(this._root, 0);
        return anyMatches;
    }
}