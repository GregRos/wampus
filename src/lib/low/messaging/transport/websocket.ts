import {EventEmitter} from "events";
import {TransportClosed, TransportError, TransportEvent, TransportMessage, Transport} from "./transport";
import * as ws from "ws";
import most = require("most");
import {WampusNetworkError} from "../../../errors/types";
const WebSocket = require('isomorphic-ws') as typeof ws;
import {MyPromise} from "../../../ext-promise";
import {Serializer} from "../serializer/serializer";
import {WampMessage, WampRawMessage} from "../../wamp/messages";
import {fromEvent, Stream} from "most";
import {WampusError} from "../../../errors/types";
import {createStreamSimple} from "../../../most-ext/most-ext";

export interface WebsocketTransportConfig {
    url: string;
    serializer: Serializer;
    timeout: number;
}

export class WebsocketTransport implements Transport{
    private _config : WebsocketTransportConfig;
    private _ws : ws;
    private _expectingClose : Promise<void>;
    events : most.Stream<TransportEvent>;

    /**
     * Use `WebsocketTransport.create` instead.
     * @param {never} never
     */
    constructor(never : never) {

    }

    /**
     * Creates a COLD stream that will create a [[WebsocketTransport]] when subscribed to.
     * The [[WebsocketTransport]] will be automatically closed when the subscription ends.
     * @param {WebsocketTransportConfig} config
     * @returns {Stream<WebsocketTransport>}
     */
    static create$(config: WebsocketTransportConfig) : most.Stream<WebsocketTransport>{

        let errorOnTimeOut = most.of(null).delay(config.timeout).map(() => {
            throw new WampusNetworkError("WebSocket connection timed out.", {
                url: config.url
            })
        }) as Stream<never>;

        let transport$ = createStreamSimple(sub => {
            let transport = new WebsocketTransport(null as never);
            transport._config = config;
            try {
                var ws = new WebSocket(config.url, `wamp.2.${config.serializer.id}`, {

                });
            }
            catch (err) {
                new WampusNetworkError("The WebSocket client could not be created.", {
                    err : err
                })
            }
            transport._ws = ws;
            let closeEvent = fromEvent("close", ws).map(x => {
                return {
                    type : "closed",
                    data : x
                } as TransportClosed;
            });

            let msgEvent : most.Stream<TransportEvent> = fromEvent("message", ws).map((msg : any) => {
                try {
                    var result = transport._config.serializer.deserialize(msg.data);
                }
                catch (err) {
                    return {
                        type : "error",
                        data : new WampusNetworkError("Received a message that could not be deserialized.", {
                            err
                        })
                    } as TransportError;
                }
                return {
                    type : "message",
                    data : result
                } as TransportMessage;
            });
            let errorEvent : most.Stream<TransportEvent>= fromEvent("error", ws).map(x => {
                return {
                    type : "error",
                    data : new WampusNetworkError("The WebSocket client emitted an error.", {
                        err : x
                    })
                } as TransportError
            });

            let messages: most.Stream<TransportEvent> = msgEvent.merge(closeEvent, errorEvent).map(x => {
                if (x.type === "closed") {
                    return most.of(x);
                } else {
                    return messages.startWith(x);
                }
            }).switchLatest().multicast();
            transport.events = messages;
            if (ws.readyState === ws.OPEN) {
                sub.next(transport);
            }
            ws.onopen = () => {
                ws.onopen = null;
                sub.next(transport);
            };
            ws.onerror = event => {
                ws.onerror = ws.onopen = null;
                sub.error(new WampusNetworkError("Failed to establish WebSocket connection with {url}. Reason: {reason}", {
                    url: config.url,
                    type: event.type,
                    reason: event.message,
                    error: event.error
                }));
            };
            return {
                async dispose() {
                    await transport._close();
                }
            }
        }) as Stream<WebsocketTransport>;

        return most.from([errorOnTimeOut, transport$]).race();
    }

    private _close(code ?: number, data ?: any): Promise<void> {
        if (this._expectingClose) {
            return this._expectingClose;
        }
        this._expectingClose =  new MyPromise((resolve, reject) => {
            if (this._ws.readyState === this._ws.CLOSED) resolve();
            this._ws.once("close", (msg) => {
                resolve();
            });
            if (this._ws.readyState !== this._ws.CLOSING) {
                this._ws.close(code, data);
            }
        });

        return this._expectingClose;
    }


    send$(msg: object): most.Stream<any> {
        return createStreamSimple(sub => {
            try {
                var payload = this._config.serializer.serialize(msg);
            }
            catch (err) {
                throw new WampusNetworkError("The message could not be serialized.", {
                    err
                });
            }
            this._ws.send(payload, {

            }, err => {
                if (err) {
                    sub.error(err);
                } else {
                    sub.complete();
                }
            });
            return {
                dispose() {

                }
            }
        });
    }

}