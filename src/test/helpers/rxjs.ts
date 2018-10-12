import {Notification, Observable, Subscription, timer} from "rxjs";
import {dematerialize, materialize, takeUntil, toArray} from "rxjs/operators";
import _ = require("lodash");

export module Rxjs {
    export function monitor<T>(source : Observable<T>) : ObservableMonitor<T> {
        return new ObservableMonitor<T>(source);
    }
}

export class ObservableMonitor<T> {
    private _unclaimed = [] as Notification<T>[];
    private _registrations = [] as ((x: Notification<T>) => void)[];
    private _sub: Subscription;

    constructor(source: Observable<T>) {

        this._sub = source.pipe(materialize()).subscribe(x => {
            if ("EC".includes(x.kind)) {
                this._unclaimed.push(x);
                for (let reg of this._registrations) {
                    reg(x);
                }
            }
            let first = this._registrations[0];
            if (first) {
                first(x);
            } else {
                this._unclaimed.push(x);
            }
        });
    }

    private _register(action: (x: { data: Notification<T>, unregister(): void }) => void) {
        let self = this;
        let registered = true;

        function unregister() {
            if (!registered) return;
            registered = false;
            _.pull(self._registrations, callback);
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
        this._registrations.push(callback);
        for (let item of this._unclaimed) {
            if (!registered) break;
            callback(item);
            if ("EC".includes(item.kind)) {
                break;
            }
            this._unclaimed.shift();
        }
        return unregister;
    }

    next$(count = 1): Observable<T> {
        return Observable.create(sub => {
            let i = 0;
            let unreg = this._register(({data, unregister}) => {
                sub.next(data);
                if (++i >= count) {
                    unregister();
                }
            });
            return {
                unsubscribe() {
                    unreg();
                }
            }
        }).pipe(dematerialize());
    }

    async next() {
        return await this.next$().toPromise();
    }

    async nextK(count: number) {
        return await this.next$(count).pipe(toArray()).toPromise();
    }

    async nextWithin(time: number) {
        return await this.next$().pipe(takeUntil(timer(time))).toPromise();
    }

    async rest() {
        return await this.next$(1000).pipe(toArray()).toPromise();
    }

    close() {
        this._sub.unsubscribe();
    }

    get isComplete() {
        return this._sub.closed;
    }

}