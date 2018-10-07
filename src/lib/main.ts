import "../setup";

import {yamprint} from "yamprint";
import * as _ from "lodash";

import {WebsocketTransport} from "./core/messaging/transport/websocket";
import {JsonSerializer} from "./core/messaging/serializer/json";
import {WampType} from "./protocol/message.type";
import {MyPromise} from "./ext-promise";
import {Session} from "./core/session";
import {EventEmitter} from "events";
import {flatMap, take, tap} from "rxjs/operators";
import {Observable} from "rxjs";
import {fromPromise} from "rxjs/internal-compatibility";
import {AbstractEventArgs} from "./core/methods/methods";
import {SessionWrapper} from "./wrappers/session-wrapper";
require("longjohn");

function firstAndKeepSub<T>(obs : Observable<Observable<T>>) : Promise<Observable<T>> & {
    unsubscribe() : void
} {
    let unsub = () => {};
    return Object.assign(new Promise<Observable<T>>((resolve, reject) => {
        let resolved = false;
        let sub = obs.subscribe(x => {
            if (resolved) return;
            resolved=  true;
            resolve(x);
        }, err => {
            resolved = true
            reject(err)
        });
        unsub = () => {
            sub.unsubscribe();
        };
    }), {
        unsubscribe() {
            unsub();
        }
    });
}

(async () => {
    let transport = WebsocketTransport.create({
        url: "ws://127.0.0.1:9003",
        serializer: new JsonSerializer(),
        timeout: 10 * 1000
    });


    let session = fromPromise(Session.create({
        realm: "proxy",
        timeout: 10000
    }, transport)).pipe(flatMap(async (lSession : Session) => {
        let session = new SessionWrapper(lSession, {

        });
        let proc_ab = await session.register({
            procedure : "a.b"
        });

        proc_ab.handle(req => {
            return {
                kwargs : {
                    a : 5
                }
            }
        });

        let z = await session.call({
            name : "a.b"
        }).result;
        let ev = await session.event({event : "hi.1"});
        ev.events.subscribe(x=> {
            console.log(yamprint(x));
        });
        await session.publish({
            name : "hi.1",
            options : {
                exclude_me: false
            },
            kwargs : {
                a : 5
            }
        });
        console.log("SUBSCRIPTIONS:", (session as any)._session._messenger._router.count());
        console.log("RESULT:", z);
        await session.close();
    })).toPromise();
})();