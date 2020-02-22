import {Transport, TransportClosed, TransportEvent, TransportError, TransportMessage} from "./transport";

import {WampusInvalidArgument, WampusNetworkError} from "../errors/types";
import {Serializer} from "../serializer/serializer";
import {fromEvent, merge, NEVER, Observable, of, race, Subject, throwError, timer} from "rxjs";
import {delay, map, mapTo, take, tap} from "rxjs/operators";
import {skipAfter} from "../../utils/rxjs-operators";

import WebSocket from "isomorphic-ws";

/**
 * The object used to configure the {@see WebsocketTransport}.
 */
export interface WebsocketTransportConfig {
    url: string;
    serializer: Serializer;
    timeout?: number;
    forceProtocol?: string;
}

/**
 * The Websocket WAMP transport.
 */
export class WebsocketTransport implements Transport {
    events$: Observable<TransportEvent>;
    private _config: WebsocketTransportConfig;
    private _ws: WebSocket;
    private _expectingClose: Promise<void>;

    /**
     * Use `WebsocketTransport.connect` instead.
     */
    private constructor() {

    }

    get name() {
        return `websocket.${this._config.serializer.id}`;
    }

    get isActive() {
        return !this._expectingClose && [WebSocket.CLOSED, WebSocket.CLOSING].indexOf(this._ws.readyState) < 0;
    }

    /**
     * Creates a COLD stream that will create a {@link  WebsocketTransport} when subscribed to.
     * The {@link  WebsocketTransport} will be automatically closed when the subscription ends.
     * @param {WebsocketTransportConfig} config
     * @returns {Observable<WebsocketTransport>}
     */
    static async create(config: WebsocketTransportConfig): Promise<WebsocketTransport> {
        if (config.timeout != null && typeof config.timeout !== "number") {
            throw new WampusInvalidArgument("Timeout value {timeout} is invalid.", {
                timeout: config.timeout
            });
        }
        if (!config.serializer || typeof config.serializer !== "object" || !["serialize", "deserialize", "id"].every(x => x in config.serializer)) {
            throw new WampusInvalidArgument("Serializer is not valid.", {
                obj: config.serializer
            });
        }
        let errorOnTimeOut$ = config.timeout == null ? NEVER : of(null).pipe(delay(config.timeout), map(() => {
            throw new WampusNetworkError("WebSocket connection timed out.", {
                url: config.url
            });
        }));

        let transport = new WebsocketTransport();
        transport._config = config;
        try {
            var ws = new WebSocket(config.url, config.forceProtocol || `wamp.2.${config.serializer.id}`, {});
        } catch (err) {
            throw(new WampusNetworkError(`The WebSocket client could not be created. ${err.message}`, {
                innerError: err
            }));
        }
        transport._ws = ws;
        let closeEvent$ = fromEvent(ws, "close").pipe(map(x => {
            return {
                type: "closed",
                data: x
            } as TransportClosed;
        }));

        let msgEvent$: Observable<TransportEvent> = fromEvent(ws, "message").pipe(map((msg: any) => {
            try {
                var result = transport._config.serializer.deserialize(msg.data);
            } catch (err) {
                return {
                    type: "error",
                    data: new WampusNetworkError("Received a message that could not be deserialized.", {
                        innerError: err
                    })
                } as TransportError;
            }
            return {
                type: "message",
                data: result
            } as TransportMessage;
        }));

        const wsErrors$ = fromEvent<Error>(ws, "error")

        let errorNow$: Observable<never> = wsErrors$.pipe(map(error  => {
            throw new WampusNetworkError(`Failed to establish WebSocket connection with ${config.url}. ${error.message}`, {
                innerError: error
            });
        }));

        let errorLater$: Observable<never> = wsErrors$.pipe(map(x => {
            throw new WampusNetworkError(`The WebSocket client closed with an error. ${x.message}`, {
                innerError: x
            });
        }));

        let openEvent$ = fromEvent(ws, "open").pipe(map(() => {
            return transport;
        }));

        transport.events$ = merge(closeEvent$, errorLater$, msgEvent$).pipe(skipAfter((x: TransportEvent) => {
            return x.type === "closed";
        }));

        return race(errorNow$, openEvent$, errorOnTimeOut$).pipe(take(1)).toPromise();
    }

    close(x ?: { code?: number, data?: any }): Promise<void> {
        let {code, data} = x || {code: undefined, data: undefined};
        if (this._expectingClose) {
            return this._expectingClose;
        }
        this._expectingClose = new Promise((resolve, reject) => {
            if (this._ws.readyState === this._ws.CLOSED) resolve();
            this._ws.once("close", msg => {
                resolve();
            });
            if (this._ws.readyState !== this._ws.CLOSING) {
                this._ws.close(code, data);
            }
        });

        return this._expectingClose;
    }

    send$(msg: object): Observable<any> {
        if (this._expectingClose) {
            return throwError(new WampusNetworkError("This transport is closing or has already closed."));
        }
        return new Observable(sub => {
            try {
                var payload = this._config.serializer.serialize(msg);
            } catch (err) {
                throw new WampusNetworkError("The message could not be serialized.", {
                    err
                });
            }
            this._ws.send(payload);
            Promise.resolve().then(() => {
                sub.complete();
            });
            return {
                unsubscribe() {

                }
            };
        });
    }

}