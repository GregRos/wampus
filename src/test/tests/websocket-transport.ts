import test from "ava";
import {describe} from 'ava-spec';
import {WebsocketTransport} from "../../lib/low/messaging/transport/websocket";
import {JsonSerializer} from "../../lib/low/messaging/serializer/json";
import ws = require("ws");

let lastMsg = null;


let testingWs = new ws.Server({

}, x => {

});

describe("connecting", () => {
    let transport = () => WebsocketTransport.create$({
        timeout : 0,
        serializer : new JsonSerializer(),
        url : ""
    })
});