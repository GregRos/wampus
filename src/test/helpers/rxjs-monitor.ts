import {Notification, Observable, timer} from "rxjs";
import {
    dematerialize,
    map,
    materialize,
    take,
    takeUntil,
    toArray
} from "rxjs/operators";
import {pull} from "lodash";

/**
 * A mixin for monitoring functionality for a hot observable.
 */
export interface Monitoring<T> {
    next$(count?: number): Observable<T>;
    next(): Promise<T>;
    nextK(count: number): Promise<T[]>;
    nextWithin(time: number): Promise<T>;
    rest(): Promise<T[]>;
    readonly isComplete: boolean;
    close(): void;
}

function mixinWithGetsetters(target, source): typeof target & typeof source {
    const descs = Object.getOwnPropertyDescriptors(source);
    Object.defineProperties(target, descs);
    return target;
}

/**
 * Adds real-time monitoring functionality to an observable.
 * @param source
 */
export function monitor<T>(source: Observable<T>): Monitoring<T> & Observable<T> {
    const unclaimed = [] as Notification<T>[];
    const registrations = [] as ((x: Notification<T>) => void)[];

    const sub = source.pipe(materialize()).subscribe(x => {
        if ("EC".includes(x.kind)) {
            unclaimed.push(x);
            for (let reg of registrations) {
                reg(x);
            }
            return;
        }
        let first = registrations[0];
        if (first) {
            first(x);
        } else {
            unclaimed.push(x);
        }
    });
    return mixinWithGetsetters(source.pipe(map(x => x)), {
        next$(count = 1): Observable<T> {
            return new Observable(sub => {
                let i = 0;
                let unreg = this._register(({data, unregister}) => {
                    sub.next(data);
                    i++;
                    if (i >= count) {
                        unregister();
                    }
                });
                return {
                    unsubscribe() {
                        unreg();
                    }
                };
            }).pipe(dematerialize());
        },
        next(): Promise<T> {
            return this.next$().toPromise();
        },
        nextK(count: number): Promise<T[]> {
            return this.next$(count).pipe(toArray()).toPromise();
        },
        nextWithin(time: number): Promise<T> {
            return this.next$().pipe(takeUntil(timer(time))).toPromise();
        },
        rest() {
            return this.next$(1000).pipe(toArray()).toPromise();
        },
        get isComplete() {
            return sub.closed;
        },
        close() {
            sub.unsubscribe();
        },
        _register(action: (x: { data: Notification<T>, unregister(): void }) => void) {
            let registered = true;

            function unregister() {
                if (!registered) return;
                registered = false;
                pull(registrations, callback);
                callback(new Notification("C"));
            }

            let callback = x => {
                let obj = {
                    data: x,
                    unregister() {
                        unregister();
                    }
                };
                action(obj);
            };
            registrations.push(callback);
            for (let item of unclaimed.slice()) {
                if (!registered) break;
                unclaimed.shift();
                callback(item);
                if ("EC".includes(item.kind)) {
                    break;
                }
            }
            return unregister;
        }
    });
}
