import {Scheduler, Sink, Stream, Subscriber} from "most";

class SubjectImpl<T> {
    private _sinks = [] as  {
        sink : Sink<T>,
        sch : Scheduler
    }[];

    run(sink : Sink<T>, sch : Scheduler) {
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

export type Subject<T> = Subscriber<T> & Stream<T>;

export module Subject {
    export function create<T>() {
        let impl = new SubjectImpl<T>();
        let stream = new Stream<T>(impl);
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