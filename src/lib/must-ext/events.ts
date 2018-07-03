import most = require("most");
import {Sink, Stream, Subscriber, Subscription} from "most";

declare module "most" {

    interface Stream<A> {
        toBuffer() : Promise<A[]>;
        toPromise() : Promise<A>;
        ofPrototype<P>(proto : {new(...args) : P}) : Stream<P>;
        switchLatest<T>(this : Stream<Stream<T>>) : Stream<T>;
        expectFirst(time : number, otherwise : () => Promise<any>) : Promise<A>;
        choose<B>(f : (x : A) => B) : Stream<B>;
        subscribe(x : Subscriber<A>) : Subscription<A>;
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
            event(t,x) {
                impl.next(x);
            },
            error(t, x) {
                impl.error(x);
            },
            end(t) {
                impl.end();
            }
        } as Sink<T>) as Sink<T> & Stream<T>;
    }
}