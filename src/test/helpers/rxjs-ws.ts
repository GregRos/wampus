import {Server, ServerOptions} from "ws";
import {promisify} from "typed-promisify"
import * as WebSocket from "ws";
import {IncomingMessage} from "http";
import {fromEvent, fromEventPattern, Observable} from "rxjs";
import {take, timeout} from "rxjs/operators";
import {WebsocketTransport} from "../../lib/core/messaging/transport/websocket";
import {JsonSerializer} from "../../lib/core/messaging/serializer/json";


export module QuickTest {
    export let testTimeout = Infinity;
}

export module QuickServer {

}

export module QuickClient {

}