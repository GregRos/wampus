import "../setup";

import {yamprint} from "yamprint";
import * as _ from "lodash";

import {WebsocketTransport} from "./low/messaging/transport/websocket";
import {JsonSerializer} from "./low/messaging/serializer/json";
import {WampType} from "./low/wamp/message.type";
import {MyPromise} from "./ext-promise";
import {InternalSession} from "./low/session";
import {EventEmitter} from "events";
import {flatMap, take, tap} from "rxjs/operators";
import {Observable} from "rxjs";
import {EventArgs} from "./low/methods/event";

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
    }).pipe(flatMap(async (session : InternalSession) => {
        await session.register({}, "a.b", req => {
            return {
                a: 5
            }
        });
        let z = await session.call$({}, "a.b", [], {}).toPromise();
        session.event$({}, "hi.1").pipe(take(1), flatMap(async (stream : Observable<EventArgs>) => {
            stream.pipe(tap(x => {
                console.log(yamprint(x));
            })).toPromise();
            await session.publish({
                exclude_me: false
            }, "hi.1", {
                kwargs : {
                    a : 5
                }
            });
            console.log("SUBSCRIPTIONS:", (session as any)._messenger._router.count());
            console.log("RESULT:", z);
        })).toPromise();
    })).toPromise();
})();