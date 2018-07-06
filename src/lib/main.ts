import "../setup";

import {yamprint} from "yamprint";
import _ = require("lodash");
import {WebsocketTransport} from "./low/transport/websocket";
import {JsonSerializer} from "./low/serializer/json";
import {WampType} from "./low/wamp/message.type";
import {MyPromise} from "./ext-promise";
import {InternalSession} from "./low/session";

(async () => {
    let transport = await WebsocketTransport.create({
        url: "ws://127.0.0.1:9003",
        serializer: new JsonSerializer(),
        timeout: 10 * 1000
    });
    transport.events.forEach(x => {
        console.log(yamprint(x.data));
    });
    let session = await InternalSession.create({
        transport: async () => transport,
        realm: "proxy",
        timeout: 10000
    });

    await session.call({}, "hi", [], {}).drain();
    let x = 5;

})();