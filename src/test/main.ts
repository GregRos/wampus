import "../setup";

import {yamprint} from "yamprint";
import * as _ from "lodash";

import {WebsocketTransport} from "../lib/core/transport/websocket";
import {JsonSerializer} from "../lib/core/serializer/json";
import {WampType} from "../lib/core/protocol/message.type";
import {MyPromise} from "../lib/utils/ext-promise";
import {WampusCoreSession} from "../lib/core/session/core-session";
import {EventEmitter} from "events";
import {flatMap, take, tap} from "rxjs/operators";
import {Observable} from "rxjs";
import {fromPromise} from "rxjs/internal-compatibility";
import {EventInvocationData} from "../lib/core/session/ticket";
import {WampusSession} from "../lib/wrappers/wampus-session";
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


    let session = fromPromise(WampusCoreSession.create({
        realm: "proxy",
        timeout: 10000,
        transport() {
            return WebsocketTransport.create({
                url: "ws://127.0.0.1:9003",
                serializer: new JsonSerializer(),
                timeout: 10 * 1000
            })
        }
    })).pipe(flatMap(async (lSession : WampusCoreSession) => {
        let session = new WampusSession(lSession, x => {});
        let proc_ab = await session.register({
            name : "a.b"
        }, async req => {
            return {
                kwargs : {
                    a : 5
                }
            }
        });
        let z = await session.call({
            name : "a.b"
        }).result;
        let ev = await session.event({name : "hi.1"});
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
        console.log("SUBSCRIPTIONS:", (session as any)._core.protocol._router.count());
        console.log("RESULT:", z);
        await session.close();
    })).toPromise();
})();