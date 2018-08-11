import {Server, ServerOptions} from "ws";
import {createStreamSimple, fromGenericEvent$} from "../../lib/most-ext/most-ext";
import * as most from "most";
import {promisify} from "typed-promisify"
import * as WebSocket from "ws";
import {IncomingMessage} from "http";

declare module "typed-promisify" {
    export function promisify(f: (cb: (err: any) => void) => void, thisContext?: any): () => Promise<any>;
}

export module TestWsServer {
    export const info = {
        host: "localhost",
        port: 9385
    } as ServerOptions;

    export const url = `http://${info.host}:${info.port}`;

    let _ws: Server;

    export async function init() {
        _ws = new Server(info);
        return _ws;
    }


    export function nextConnection(): Promise<{ socket: WebSocket, req: IncomingMessage }> {
        let firstConnection = fromGenericEvent$(_ws, "connection", (socket, req) => {
            return {socket, req};
        }).take(1).toPromise();

        return firstConnection;
    }

    export function nextJsonMessage(socket : WebSocket) : Promise<any> {
        let msgs = fromGenericEvent$(socket, "message", (data : Buffer, type) => {
            let decoded = data.toString("utf8");
            let parsed = JSON.parse(decoded);
            return parsed;
        });
        return msgs.take(1).toPromise();
    }
}
