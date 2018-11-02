import {Observable, Subscription} from "rxjs";
import {EventEmitter} from "events";
import {Errs} from "../core/errors/errors";
import {Errors} from "../wrappers/errors";

export interface EventEmitted {
    name : string;
    arg : any;
}



export class RxjsEventAdapter<T> {
    private _sub : Subscription;
    private _emitter : EventEmitter;
    constructor(private _source : Observable<T>, private _selector : (x : T) => EventEmitted, private _events : string[]) {

    }

    private _initEmitter() {
        if (this._emitter) return;
        this._emitter = new EventEmitter();
        this._sub = this._source.subscribe(data => {
            let event = this._selector(data);
            this._emitter.emit(event.name, event.arg);
        });
    }


    on(name : string, handler : (x : any) => void) {
        if (!this._events.includes(name)) {
            throw Errors.unknownEvent(name);
        }
        this._initEmitter();
        this._emitter.on(name, handler);
    }

    off(name : string, handler : any) {
        this._emitter.off(name, handler);
    }
}