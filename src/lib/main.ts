import "../setup";

import {yamprint} from "yamprint";
import _ = require("lodash");
import {WebsocketTransport} from "./low/messaging/transport/websocket";
import {JsonSerializer} from "./low/messaging/serializer/json";
import {WampType} from "./low/wamp/message.type";
import {MyPromise} from "./ext-promise";
import {InternalSession} from "./low/session";
import {EventEmitter} from "events";
import {never, of, periodic, Stream} from "most";

(async () => {
    let transport = WebsocketTransport.create$({
        url: "ws://127.0.0.1:9003",
        serializer: new JsonSerializer(),
        timeout: 10 * 1000
    });
    let session = InternalSession.create$({
        transport$: transport,
        realm: "proxy",
        timeout: 10000
    }).flatMapPromise(async session => {
        session.register$({}, "a.b").switchLatest().flatMapPromise(async x => {
            await x.return({
                kwargs : {
                    a : 5
                }
            });
        });

        let z = await session.call$({}, "a.b", [], {}).drain();
        session.event$({}, "hi.1").take(1).flatMapPromise(async stream => {
            stream.tap(x => {
                console.log(yamprint(x));
            }).drain();
            await session.publisher({
                exclude_me : false
            }, "hi.1")([], {a : 5});
            console.log("SUBSCRIPTIONS:", (session as any)._messenger._router.count());
            console.log("RESULT:", z);
        }).drain();
    }).drain();
})();