import "../setup";

import {yamprint} from "yamprint";
import _ = require("lodash");
import {WebsocketTransport} from "./transport/websocket";
import {WampusJsonSerializer} from "./serializer/json";
import {WampMsgType} from "./proto/message.type";
import {MyPromise} from "./ext-promise";
import {WampusSession} from "./wamp/session";

(async () => {
    let transport = await WebsocketTransport.create({
        url: "ws://127.0.0.1:9003",
        serializer: new WampusJsonSerializer(),
        timeout: 10 * 1000
    });
    transport.events.forEach(x => {
        console.log(yamprint(x.data));
    });
    let session = await WampusSession.create({
        transport: async () => transport,
        realm: "proxy",
        timeout: 10000
    });

    await session.call({}, "hi", [], {}).drain();
    let x = 5;

})();