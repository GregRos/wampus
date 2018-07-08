import most = require("most");
import {Sink, Stream, Subscriber, Subscription, Disposable} from "most";

declare module "most" {

    interface Stream<A> {
        toBuffer() : Promise<A[]>;
        toPromise() : Promise<A>;
        ofPrototype<P>(proto : {new(...args) : P}) : Stream<P>;
        switchLatest<T>(this : Stream<Stream<T>>) : Stream<T>;
        expectFirst(time : number, otherwise : () => Promise<any>) : Promise<A>;
        choose<B>(f : (x : A) => B) : Stream<B>;
        subscribe(x : Partial<Subscriber<A>>) : Subscription<A>;
        publishReplay(size : number) : Stream<A> & {attach() : Subscription<A>};
        mapError(projection : (x : any) => any) : Stream<A>;
        lastly(f : () => void) : Stream<A>;
        tapFull(observer : Partial<Subscriber<A>>) : Stream<A>;
        flatMapPromise<B>(projection : (x : A) => Stream<B> | Promise<B> | B) : Stream<B>
    }


    interface Disposable<A> {
        dispose() : void | Promise<any>;
    }
}

Object.assign(most.Stream.prototype, {
    toBuffer<T>(this : most.Stream<T>) {
        return this.reduce((tot,cur) => {
            tot.push(cur);
            return tot;
        }, [])
    },
    toPromise<T>(this : most.Stream<T>) {
        return this.reduce((last, cur) => cur, undefined);
    },
    ofPrototype<T, P>(this : most.Stream<T>, ctor : {new(...args) : P}) {
        return this.filter(s => s instanceof ctor)  as any as most.Stream<P>;
    },
    expectFirst<T>(this : most.Stream<T>, time : number, otherwise : () => Promise<any>) {
        return this.takeUntil(most.periodic(time)).take(1).toBuffer().then(x => {
            if (x.length === 0) return otherwise();
            return x[0];
        });
    },
    choose<T, S>(this : most.Stream<T>, f : (x : T) => S) {
        return this.map(f).filter(x => x !== undefined);
    },
    mapError<T>(this : most.Stream<T>, projection : (x : any) => any) {
        return this.recoverWith<any>(err => {
            return most.throwError(projection(err));
        });
    },
    flatMapPromise<A, B>(this : most.Stream<A>, project : (x : A) => Stream<B> | Promise<B> | B) {
        return this.flatMap(x => {
            let result = project(x) as any;
            if (result instanceof Stream) {
                return result;
            } else if (typeof result.then === "function") {
                return most.fromPromise(result);
            } else {
                return most.just(result);
            }
        });
    },

    tapFull<T>(this : most.Stream<T>, subscriber : Subscriber<T>) {
        return new most.Stream({
            run : (sink, sch) => {
                let sub = this.subscribe({
                    next(v) {
                        try {
                            subscriber.next && subscriber.next(v);
                            sink.event(sch.now(), v);
                        }
                        catch (err) {
                            sub.unsubscribe();
                            return sink.error(sch.now(), err);
                        }

                    },
                    complete(v) {
                        sub.unsubscribe();
                        try {
                            subscriber.complete && subscriber.complete(v);
                            sink.end(sch.now(), v);
                        }
                        catch (err) {
                            return sink.error(sch.now(), err);
                        }

                    },
                    error(e) {
                        sub.unsubscribe();
                        try {
                            subscriber.error && subscriber.error(e);
                        }
                        catch (err) {
                            sink.error(sch.now(), err);
                            return;
                        }
                        sink.error(sch.now(), e);
                    }
                });
                return {
                    dispose() {
                        return sub.unsubscribe();
                    }
                }
            }
        })
    },
    lastly<T>(this : most.Stream<T>, f : () => Promise<void>) {
        let whenDisposed = new most.Stream<any>({
            run(sink, sch) {
                return {
                    async dispose() {
                        await f();
                        return {};
                    }
                }

            }
        });
        return this.merge(whenDisposed) as most.Stream<T>;
    },
    publishReplay<T>(this : most.Stream<T>, size : number) : most.Stream<T> & {attach() : most.Subscription<T>} {
        let buffer = Array(size);
        let error = null;
        let self = this;
        let broadcast = Subject.create();
        let selfSub = null;
        let attachable = {
            attach() {
                if (selfSub) return selfSub;
                return selfSub = self.subscribe({
                    next(v) {
                        if (buffer.length >= size) {
                            buffer.splice(0, 1);
                            buffer.push(v);
                        }
                        broadcast.next(v);
                    },
                    error(x) {
                        error = x;
                        broadcast.error(error);
                    },
                    complete() {
                        broadcast.complete()
                    }
                })
            }
        };
        return Object.assign(new most.Stream({
            run(sink, sch) {
                let sub : Subscription<any>;
                let disposed = false;
                Promise.resolve().then(() => {
                    if (disposed) return;
                    buffer.forEach(x => {
                        sink.event(sch.now(), x);
                    });
                    if (error) {
                        sink.error(sch.now(), error);
                        return;
                    }
                    sub = broadcast.subscribe({
                        next(v) {
                            sink.event(sch.now(), v);
                        },
                        error(err) {
                            sink.error(sch.now(), err);
                        },
                        complete(v) {
                            sink.end(sch.now(), v);
                        }
                    })
                });
                return {
                    dispose() {
                        disposed = true;
                        if (sub) sub.unsubscribe();
                    }
                }
            }
        }) as any, attachable);
    }
});

class SubjectImpl<T> {
    private _sinks = [] as  {
        sink : Sink<T>,
        sch : most.Scheduler
    }[];

    run(sink : Sink<T>, sch : most.Scheduler) {
        let snk = {
            sch,
            sink
        };
        this._sinks.push(snk);
        return {
            dispose : () => {
                let ix = this._sinks.indexOf(snk)
                if (ix === -1) return;
                this._sinks.splice(ix, 1);
            }
        }
    }

    next(x : T) {
        this._sinks.forEach(({sink, sch}) => {
            sink.event(sch.now(), x);
        });
    }

    end() {
        this._sinks.forEach(({sink, sch}) => {
            sink.end(sch.now());
        });
    }

    error(err : Error) {
        this._sinks.forEach(({sink, sch}) => {
            sink.error(sch.now(), err);
        })
    }
}

export module Subject {
    export function create<T>() {
        let impl = new SubjectImpl<T>();
        let stream = new most.Stream<T>(impl);
        return Object.assign(stream, {
            next(x) {
                impl.next(x);
            },
            error(x) {
                impl.error(x);
            },
            complete() {
                impl.end();
            }
        } as Subscriber<T>) as Subscriber<T> & Stream<T>;
    }
}