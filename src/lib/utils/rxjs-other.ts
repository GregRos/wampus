import {Observable, Subscription} from "rxjs";
import {EventEmitter} from "events";
import {Errors} from "../wrappers/errors";

/**
 * An event emitted.
 * @internal
 * */
export interface EventEmitted {
    name: string;
    arg: any;
}


/**
 * A compat layer for observables and events.
 * @internal
 * */
export class RxjsEventAdapter {
    private _sub: Subscription;
    private _emitter: EventEmitter;

    constructor(private _source: Observable<any>, private _selector: (x: any) => EventEmitted, private _events: string[]) {

    }

    on(name: string, handler: (x: any) => void) {
        if (this._events.indexOf(name) < 0) {
            throw Errors.unknownEvent(name);
        }
        this._initEmitter();
        this._emitter.addListener(name, handler);
    }

    off(name: string, handler: any) {
        this._emitter.removeListener(name, handler);
    }

    private _initEmitter() {
        if (this._emitter) return;
        this._emitter = new EventEmitter();
        this._sub = this._source.subscribe(data => {
            let event = this._selector(data);
            this._emitter.emit(event.name, event.arg);
        });
    }
}