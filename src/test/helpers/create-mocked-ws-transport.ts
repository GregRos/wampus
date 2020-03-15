import {rewiremock} from "~test/helpers/rewiremock";
import WebSocket from "isomorphic-ws";
import {InputEvent, MockWebsocket} from "~test/helpers/mock-ws";
import {Subject} from "rxjs";
import {JsonSerializer} from "~lib/core/serializer/json";
import {monitor} from "~test/helpers/monitored-observable";
import {WebsocketTransportConfig} from "~lib/core/transport/websocket";
import { defaults } from "lodash";

export function getModuleWithPatchedWs(alt: () => void): typeof import("~lib/core/transport/websocket") {
    return rewiremock.proxy(() => require("~lib/core/transport/websocket"), r => {
        return {
            "isomorphic-ws": Object.assign(alt, WebSocket)
        };
    });
}

export function getCommonTransport(cfg?: Partial<WebsocketTransportConfig>) {
    let constructed: MockWebsocket = null;
    const cfg2 = defaults(cfg, {
        serializer: new JsonSerializer(),
        url: "ws://localhost:3000"
    });
    const mock = function(...args) {
        constructed = new MockWebsocket(args[0], args[1], args[2]);
        constructed.serializer = cfg2.serializer;
        return constructed;
    }; 
    const {WebsocketTransport} = getModuleWithPatchedWs(mock);
    const conn = WebsocketTransport.create(cfg2);
    return {
        ws: constructed,
        transport: conn
    };
}