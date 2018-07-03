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
                return cur;
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
            if (!cur) return null;
            if (keys.length <= index) {
                let foundIndex = cur.match.indexOf(target);
                if (foundIndex === -1) return cur;
                cur.match.splice(index, 1);
                if (cur.match.length === 0 && !cur.next) return null;
            }
            if (cur.next){
                let next = cur.next.get(keys[index]);
                if (!next) return cur;
                next = rec(next, index + 1);
                if (!next) {
                    cur.next.delete(keys[index]);
                }
            }
            return cur;
        };
    }

    expectFirst(...options : any[][]) : most.Stream<WampMessage.Any> {
        return most.mergeArray(options.map(key => this.expectOne(key))).take(1);
    }

    expectOne(...keys : any[]) {
        return new most.Stream<WampMessage.Any>({
            run : (sink, sch) => {
                let target = x => {
                    sink.event(sch.now(), x);
                    return true;
                };
                this.insertRoute(keys, target);
                return {
                    dispose : () => {
                        this.removeRoute(keys, target);
                    }
                }
            }
        });
    }

    match(keys : any[], object : T) {
        let anyMatches = false;
        let rec = (cur : RouteIndex<T>, index : number) => {
            if (!cur) return null;
            if (cur.match.length > 0) {
                anyMatches = true;
            }
            cur.match = cur.match.filter(rt => !rt(object));
            if (cur.match.length === 0 && !cur.next) {
                return null;
            }
            if (cur.next) {
                let next = cur.next.get(keys[index]);
                if (!next) return cur;
                next = rec(next, index + 1);
                if (!next) {
                    cur.next.delete(keys[index]);
                }
            }
            return cur;
        };
        rec(this._root, 0);
        return anyMatches;
    }

    reset() {
        this._root = null;
    }
}