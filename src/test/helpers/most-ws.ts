import {Server, ServerOptions} from "ws";
import {createStreamSimple} from "../../lib/most-ext/most-ext";
import most = require("most");



export class MostWsServer {
    private _ws : Server;
    get connection() {
        return most.fromEvent("connection", this._ws).map(([ws,req]) => {
            return ws;
        })
    }

    static create$(opts : ServerOptions) {
        return createStreamSimple(sub => {
            let srv = new MostWsServer();
            let wsSrv = new Server(opts, () => {
                srv._ws = wsSrv;
                sub.next(srv);
            });
        });
    }
}