import {fromEvent, Observable} from "rxjs";
import {map, take, takeUntil} from "rxjs/operators";
import {WebsocketTransport} from "~lib/core/transport/websocket";
import {JsonSerializer} from "~lib/core/serializer/json";
import WebSocket, {Server} from "isomorphic-ws";
import {MockWebsocket} from "./mock-ws";
import {getCommonTransport} from "~test/helpers/create-mocked-ws-transport";

export async function getTransportAndServerConn() {
    const {ws, transport} = getCommonTransport();
    ws.in.next({
        event: "open"
    });

    return {
        ws,
        transport: await transport
    };
}

export function sendVia(server: WebSocket, data: any): Promise<void> {
    return new Observable<void>(sub => {
        server.send(JSON.stringify(data), err => {
            if (err) {
                return sub.error(err);
            }
            sub.complete();
        });
    }).toPromise();
}

export function receiveObjects$(server: WebSocket): Observable<any> {
    let wsClose = fromEvent(server, "close");
    return fromEvent(server, "message").pipe(map((x: any) => {
        return JSON.parse(x.data);
    }), takeUntil(wsClose));
}