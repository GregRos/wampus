import {fromEvent, Observable} from "rxjs";
import WebSocket = require("ws");
import {map, take, takeUntil} from "rxjs/operators";
import {WebsocketTransport} from "../../lib/core/messaging/transport/websocket";
import {JsonSerializer} from "../../lib/core/messaging/serializer/json";


export class RxjsWsServer {
    public _innerServer : WebSocket.Server;
    private _port : number;
    get url() {
        return `ws://localhost:${this._port}`;
    }
    static async create(port : number) {
        let createServer$ = Observable.create((sub) => {
            let server = new WebSocket.Server({
                port : port
            }, () => {
                sub.next(server);
            });
            server.on("error", err => {
                sub.error(err);
            });
        }) as Observable<WebSocket.Server>;
        let innerWs = await createServer$.pipe(take(1)).toPromise();
        let outerWs = new RxjsWsServer();
        outerWs._innerServer = innerWs;
        outerWs._port = port;
        return outerWs;
    }



    getConnectionFromServerSide(protocol : string) {
        return [...this._innerServer.clients].find(x => x.protocol === protocol);
    }
}

export const rxjsWsServer = RxjsWsServer.create(9000 + Math.floor(Math.random() * 1000));

export async function getTransportAndServerConn() {
    let srv = await rxjsWsServer;
    let rnd = (Math.random() * 100000).toString(36);
    let clientConn = await WebsocketTransport.create({
        url: srv.url,
        serializer: new JsonSerializer(),
        forceProtocol : rnd
    });
    let servConn = srv.getConnectionFromServerSide(rnd);
    return {
        clientConn,
        servConn
    }
}

export function sendVia(server : WebSocket, data : any) : Promise<void> {
    return Observable.create(sub => {
        server.send(JSON.stringify(data), err => {
            if (err) {
                return sub.error(err);
            }
            sub.complete();
        });
    }).toPromise();
}

export function receiveObjects$(server : WebSocket) : Observable<any>{
    let wsClose = fromEvent(server, "close");
    return fromEvent(server, "message").pipe(map((x : any) => {
        let parsed = JSON.parse(x.data as any);
        return parsed;
    }), takeUntil(wsClose));
}