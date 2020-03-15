import OrigWebsocket from "isomorphic-ws";
import EventEmitter = require("events");
import {merge, Observable, Subject} from "rxjs";
import {skipAfter} from "~lib/utils/rxjs-operators";
import {filter} from "rxjs/operators";
import {monitor} from "~test/helpers/monitored-observable";
import {Serializer} from "~lib/core/serializer/serializer";

// tslint:disable:completed-docs

export interface MessageEvent {
    event: "message";
    data: any;
}

export interface OpenEvent {
    event: "open";
}

export interface CloseEvent {
    event: "close";
    data?: {
        code?: number;
        reason?: string
    };
}

export interface ErrorEvent {
    event: "error";
    data: any;
}

export type InputEvent = MessageEvent | OpenEvent | CloseEvent | ErrorEvent;

export type OutputEvent = MessageEvent | CloseEvent;

export class MockWebsocket extends EventEmitter {
    binaryType = null;
    bufferedAmount = null;
    extensions = null;
    private readonly _out = new Subject<OutputEvent>();
    readonly out = monitor(this._out.asObservable());
    readonly in = new Subject<InputEvent>();
    serializer: Serializer;
    constructor(
        public readonly url: string,
        public readonly protocol: string,
        public readonly options: unknown
    ) {
        super();
        merge(
            this.in,
            this.out.pipe(filter(x => x.event === "close"))
        ).pipe(skipAfter(x => x.event === "close")).subscribe(event => {
            switch (event.event) {
                case "close":
                case "error":
                    this.readyState = OrigWebsocket.CLOSED;
                    break;
                case "open":
                    this.readyState = OrigWebsocket.OPEN;
                    break;
            }
            if (event.event === "message") {
                this.emit(event.event, {
                    data: this.serializer.serialize(event.data)
                });
            } else {
                this.emit(event.event, (event as any).data || {});
            }

        });
    }

    readyState: number;
    CONNECTING = OrigWebsocket.CONNECTING;
    OPEN = OrigWebsocket.OPEN;
    CLOSING = OrigWebsocket.CLOSING;
    CLOSED = OrigWebsocket.CLOSED;
    close(code?: number, data?: string): void {
        this.readyState = OrigWebsocket.CLOSING;
        setTimeout(() => {
            this._out.next({
                event: "close",
                data: {
                    code,
                    reason: data
                }
            });
        }, 0);
    }

    send(data: any, options?: any, cb?: any) {
        setTimeout(() => {
            this._out.next({
                event: "message",
                data: this.serializer?.deserialize(data) || data
            });
        }, 0);
    }

    addEventListener(method: any, listener?: any) {
        this.on(method, listener);
    }

    removeEventListener(method: any, listener?: any) {
        this.off(method, listener);
    }
}

Object.assign(MockWebsocket, OrigWebsocket);
