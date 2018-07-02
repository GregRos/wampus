import most = require("most");

declare module "most" {
    interface Stream<A> {
        toBuffer() : Promise<A[]>;
        toPromise() : Promise<A>;
        ofPrototype<P>(proto : {new(...args) : P}) : Stream<P>;
        switchLatest<T>(this : Stream<Stream<T>>) : Stream<T>;
        expectFirst(time : number, otherwise : () => Promise<any>) : Promise<A>;
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
    }
});