import {Observable} from "rxjs";
import WebSocket = require("ws");


export class RxjsWsServer {

}

export class RxjsWsConnection {
    private _ws : WebSocket;
    send$(data : any) {
        this._ws.send(data, )
    }
}