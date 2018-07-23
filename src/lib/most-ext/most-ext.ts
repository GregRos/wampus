import most = require("most");
import {Sink, Stream, Subscriber, Subscription, Disposable, Scheduler} from "most";

declare module "most" {

    interface Stream<A> {
        toPromise(): Promise<A>;

        ofPrototype<P>(proto: { new(...args): P }): Stream<P>;

        switchLatest<T>(this: Stream<Stream<T>>): Stream<T>;

        choose<B>(f: (x: A) => B): Stream<B>;

        subscribe(x: Partial<Subscriber<A>>): Subscription<A>;

        lastly(f: () => void | Promise<void>): Stream<A>;

        flatMapPromise<B>(projection: (x: A) => Stream<B> | Promise<B> | B | Promise<Stream<B>>): Stream<B>;

        deriveDependentResource<B>(projection: (x: A) => Stream<B>): Stream<B>;

        race<B>(this: Stream<Stream<B>>): Stream<B>;

        switchMap<B>(this: Stream<Stream<A>>, map: (x: A) => Stream<A>): Stream<B>

        subscribeSimple(next: (x: A) => void, error ?: (x: Error) => void, complete ?: () => void): Subscription<A>;
    }

    interface Disposable<A> {
        dispose(): void | Promise<any>;
    }
}

export function defer$<A>(executor: () => Stream<A>) {
    return most.of(null).flatMap(executor);
}

export function wait$<A>(time: number, value ?: A) {
    return most.of(value).delay(time);
}

export function lastly$(f : () => Promise<any> | any) {
    return new Stream<any>({
        run(sink, sch) {
            return {
                async dispose() {
                    await f();
                }
            }
        }
    })
}

export function sinkToSubscriber<T>(sch: Scheduler, sink: Sink<T>): Subscriber<T> {
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

export function createStreamSimple<T>(subscribe: (subscriber: Subscriber<T>) => Disposable<any>): Stream<T> {
    return new Stream({
        run(sink, sch) {
            let subscriber = sinkToSubscriber(sch, sink);
            let subscription = subscribe({
                complete(v) {
                    try {
                        sink.end(sch.now(), v);
                    }
                    catch (err) {
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
    toPromise<T>(this: most.Stream<T>) {
        return this.reduce((last, cur) => cur, undefined);
    },
    ofPrototype<T, P>(this: most.Stream<T>, ctor: { new(...args): P }) {
        return this.filter(s => s instanceof ctor)  as any as most.Stream<P>;
    },
    choose<T, S>(this: most.Stream<T>, f: (x: T) => S) {
        return this.map(f).filter(x => x !== undefined);
    },
    flatMapPromise<A, B>(this: most.Stream<A>, project: (x: A) => Stream<B> | Promise<B> | B) {
        return this.flatMap(x => {
            let result = project(x) as any;
            if (result instanceof Stream) {
                return result;
            } else if (typeof result.then === "function") {
                return most.fromPromise(result).flatMap(x => {
                    if (x instanceof Stream) {
                        return x;
                    }
                    return most.of(x);
                });
            } else {
                return most.just(result);
            }
        });
    },
    lastly<T>(this: most.Stream<T>, f: () => Promise<void>) {
        let whenDisposed = lastly$(f);
        return this.merge(whenDisposed) as most.Stream<T>;
    },
    race<T, S>(this: most.Stream<most.Stream<T>>) {
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
    switchMap<T, S>(this: Stream<T>, map: (x: T) => Stream<S>) {
        return this.map(map).switchLatest();
    },
    subscribeSimple<A>(this: Stream<A>, error ?: (err: Error) => void, next ?: (x: A) => void, complete ?: () => void) {
        return this.subscribe({
            complete,
            next,
            error
        });
    },
    deriveDependentResource<A, B>(this: Stream<A>, dependentResourceFactory: (x: A) => Stream<B>) {
        let self = this;
        return new Stream({
            run(sink, sch) {
                let isOuterDisposed = false;
                let innerSubs = new Set<Disposable<B>>();
                let outerSub = self.source.run({
                    event(t, outerElement) {
                        try {
                            let innerStream = dependentResourceFactory(outerElement);
                            let innerSub = innerStream.source.run({
                                event(t, v) {
                                    try {
                                        sink.event(t, v);
                                    }
                                    catch (err) {
                                        this.error(sch.now(), err);
                                    }
                                },
                                error(t, err) {
                                    innerSubs.delete(innerSub);
                                    sink.error(t, err);
                                },
                                end(t) {
                                    innerSubs.delete(innerSub);
                                    try {
                                        sink.end(t);
                                    }
                                    catch (err) {
                                        sink.error(sch.now(), err);
                                    }
                                }
                            }, sch);
                            innerSubs.add(innerSub);
                        }
                        catch (err) {
                            sink.error(t, err);
                        }
                    },
                    error(t, err) {
                        sink.error(t, err);
                    },
                    end(t) {
                        if (innerSubs.size === 0) {
                            sink.end(t);
                        } else {
                            sink.error(t, new Error("The parent resource stream has been disposed."))
                        }

                    }
                }, sch);
                return {
                    async dispose() {
                        isOuterDisposed = true;
                        await Promise.all(Array.from(innerSubs).map(x => x.dispose()));
                        await outerSub.dispose();
                        return {};
                    }
                };
            }
        })
    }
});