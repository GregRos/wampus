import most = require("most");
import {Sink, Stream, Subscriber, Subscription, Disposable, Scheduler} from "most";

declare module "most" {

    interface Stream<A> {
        toPromise() : Promise<A>;
        ofPrototype<P>(proto : {new(...args) : P}) : Stream<P>;
        switchLatest<T>(this : Stream<Stream<T>>) : Stream<T>;
        choose<B>(f : (x : A) => B) : Stream<B>;
        subscribe(x : Partial<Subscriber<A>>) : Subscription<A>;
        lastly(f : () => void) : Stream<A>;
        flatMapPromise<B>(projection : (x : A) => Stream<B> | Promise<B> | B) : Stream<B>;
        race<B>(this : Stream<Stream<B>>) : Stream<B>;
        switchMap<B>(this : Stream<Stream<A>>, map : (x : A) => Stream<A>) : Stream<B>
        subscribeSimple(next : (x : A) => void, error ?: (x : Error) => void, complete ?: () => void) : Subscription<A>;
    }

    interface Disposable<A> {
        dispose() : void | Promise<any>;
    }
}

export function sinkToSubscriber<T>(sch : Scheduler, sink : Sink<T>) : Subscriber<T> {
    return {
        next(v) {
            sink.event(sch.now(), v);
        },
        error(err) {
            sink.error(sch.now(), err);
        },
        complete(v) {
            sink.end(sch.now(), v);
        }
    }
}

export function createStreamSimple<T>(subscribe : (subscriber : Subscriber<T>) => Disposable<any>) : Stream<T> {
    return new Stream({
        run(sink, sch) {
            let subscriber = sinkToSubscriber(sch, sink);
            let subscription = subscribe({
                complete(v) {
                    try {
                        sink.end(sch.now(), v);
                    }
                    catch(err) {
                        sink.error(sch.now(), err);
                    }
                },
                error(err) {
                    sink.error(sch.now(), err);
                },
                next(v) {
                    try {
                        sink.event(sch.now(), v);
                    }
                    catch (err) {
                        sink.error(sch.now(), err);
                    }
                }
            });
            return {
                dispose() {
                    return subscription.dispose();
                }
            }
        }
    })
}

Object.assign(most.Stream.prototype, {
    toPromise<T>(this : most.Stream<T>) {
        return this.reduce((last, cur) => cur, undefined);
    },
    ofPrototype<T, P>(this : most.Stream<T>, ctor : {new(...args) : P}) {
        return this.filter(s => s instanceof ctor)  as any as most.Stream<P>;
    },
    choose<T, S>(this : most.Stream<T>, f : (x : T) => S) {
        return this.map(f).filter(x => x !== undefined);
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
    race<T, S>(this : most.Stream<most.Stream<T>>)  {
        return createStreamSimple(mySubscriber => {
            let childSubs = [] as Subscription<T>[];

            let myInnerSub = this.tap(stream => {
                let curChildSub = stream.subscribe({
                    next(x) {
                        if (childSubs.length > 1) {
                            childSubs.forEach(x => {
                                if (x === curChildSub) return;
                                x.unsubscribe();
                            });
                            childSubs = [curChildSub];
                        }
                        mySubscriber.next(x);
                    },
                    error(err) {
                        mySubscriber.error(err);
                    },
                    complete() {
                        if (childSubs.length > 1) {
                            childSubs = childSubs.filter(x => x !== curChildSub);
                        } else {
                            mySubscriber.complete();
                        }

                    }
                });
                childSubs.push(curChildSub);
            }).subscribe({});

            return {
                dispose() {
                    myInnerSub.unsubscribe();
                    childSubs.forEach(sub => sub.unsubscribe());
                }
            }
        });
    },
    switchMap<T, S>(this : Stream<T>, map : (x : T) => Stream<S>) {
        return this.map(map).switchLatest();
    },
    subscribeSimple<A>(this : Stream<A>, error ?: (err : Error) => void, next : (x : A) => void, complete ?: () => void) {
        return this.subscribe({
            complete,
            next,
            error
        });
    }
});