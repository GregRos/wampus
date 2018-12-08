import {Transport, TransportEvent} from "../../lib/core/transport/transport";
import {concat, defer, EMPTY, Observable, Subject, timer} from "rxjs";
import {WampArray, WampMessage, WampRawMessage} from "../../lib/core/protocol/messages";
import {choose} from "../../lib/utils/rxjs-operators";
import {MyPromise} from "../../lib/utils/ext-promise";
import {map, mergeMapTo} from "rxjs/operators";
import {WampusNetworkError} from "../../lib/core/errors/types";
import {MessageReader} from "../../lib/core/protocol/reader";
import {ObservableMonitor, Rxjs} from "./observable-monitor";

export interface DummyServer {
    readonly events: Observable<TransportEvent>;
    readonly messages: Observable<WampRawMessage>;

    error(x: WampusNetworkError): void;

    send(x: WampRawMessage): void;

    close(): void;
}

let reader = new MessageReader();

export class HigherLevelDummyServer {
    messages: ObservableMonitor<any>;

    constructor(private _server: DummyServer) {
        this.messages = Rxjs.monitor(_server.messages.pipe(map(x => reader.parse(x))));
    }

    error(x: WampusNetworkError) {
        this._server.error(x);
    }

    close() {
        this._server.close();
    }

    send(x: WampMessage.Any) {
        this._server.send(x.toTransportFormat());
    }

}

export function dummyTransport() {
    let intoClient = new Subject<TransportEvent>();
    let intoServer = new Subject<TransportEvent>();
    let isActive = true;

    function done() {
        isActive = false;
    }


    let server: DummyServer = {
        error(x) {
            MyPromise.soon(() => {
                intoClient.next({
                    type: "error",
                    data: x
                });
            });
        },
        send(x) {
            MyPromise.soon(() => {
                intoClient.next({
                    type: "message",
                    data: x
                });
            });
        },
        close() {
            MyPromise.soon(() => {
                intoClient.next({
                    type: "closed",
                    data: {}
                });
                done();
            });
        },
        events: intoServer,
        messages: intoServer.pipe(choose(x => x.type === "message" ? x.data as WampArray : undefined))
    };
    return {
        client: {
            name: "dummy",
            async close() {
                intoServer.next({
                    type: "closed",
                    data: {}
                });
                done();
            },
            events$: intoClient,
            send$(x) {
                return concat(timer(Math.random() * 20), defer(() => {
                    intoServer.next({
                        type: "message",
                        data: x as any[]
                    });
                    return EMPTY;
                })).pipe(mergeMapTo(EMPTY));
            },
            get isActive() {
                return isActive;
            }
        } as Transport,
        server: server
    };
}