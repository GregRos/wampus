import test from "ava";

import {describe} from 'ava-spec';
import {WebsocketTransport} from "../../lib/low/messaging/transport/websocket";
import {JsonSerializer} from "../../lib/low/messaging/serializer/json";
import * as ws from "ws";
import {TestWsServer} from "../helpers/most-ws";

let lastMsg = null;



function getTransport$(timeout : number) {
    return WebsocketTransport.create$({
        url : `http://${TestWsServer.info.host}:${TestWsServer.info.port}`,
        serializer : new JsonSerializer(),
        timeout : timeout
    });
}


test.before(async () => {
    await TestWsServer.init()
});

describe("connecting", () => {

    test("successful", async t => {
        let transport = getTransport$(null);
        let conn = TestWsServer.nextConnection().then((x) => {
            console.log("HUH?");
            return x;
        });
        let x = transport.drain();
        let {req,socket} = await conn;
        let a = 1;
    })
});