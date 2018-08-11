import test from "ava";

import {describe} from 'ava-spec';
import {WebsocketTransport} from "../../lib/core/messaging/transport/websocket";
import {JsonSerializer} from "../../lib/core/messaging/serializer/json";
import * as ws from "ws";
import {QuickClient, QuickServer} from "../helpers/rxjs-ws";
import {concat, defer, fromEvent, merge, NEVER, Observable, timer, zip} from "rxjs";
import {delay, flatMap, map, mapTo, take, takeUntil, takeWhile, tap, timeout} from "rxjs/operators";
import {ServerOptions} from "ws";
import {Server} from "ws";
import {IncomingMessage} from "http";
import WebSocket = require("ws");
import {WampusError, WampusNetworkError} from "../../lib/errors/types";
import {TransportEvent} from "../../lib/core/messaging/transport/transport";
import {fromPromise} from "rxjs/internal-compatibility";

let acquireConnections = () => zip(wsTransport(null), connection()).pipe(map(([client, server]) => {
    return {
        client,
        server
    }
}));

function sendObj$(server : WebSocket, data : any) : Observable<any> {
    return Observable.create(sub => {
        server.send(JSON.stringify(data), err => {
            if (err) {
                return sub.error(err);
            }
            sub.complete();
        });
    })
}

describe("connection", test => {
    test.serial("can acquire connection", t => {
        return acquireConnections().pipe(map(({client, server
        }) => {
            t.is(server.socket.readyState, server.socket.OPEN);
        })).pipe(take(1));
    });

    test.serial("protocol is assigned", (t) => {
        return acquireConnections().pipe(map(({server : {socket,req}, client}) => {
            t.is(socket.protocol, "wamp.2.json");
        })).pipe(take(1));
    });

    test.serial("connection stays open", t => {
        return acquireConnections().pipe(flatMap((pair) => {
            return timer(1000).pipe(mapTo(pair));
        })).pipe(map(pair => {
            t.is(pair.server.socket.readyState, WebSocket.OPEN);
            return pair;
        })).pipe(take(1));
    });


    test.serial("connection closes on completion", t => {
        let conns = acquireConnections();
        let pair : any;
        conns = conns.pipe(tap(p => {
            pair = p;
        }));
        let delayRx = timer(1000).pipe(mapTo(-1 as any))
        let makeSureConnIsDead = defer(() => {
            let {server, client} = pair;
            t.is(server.socket.readyState, WebSocket.CLOSED);
        });
        let connIsAliveHere = merge(conns, delayRx).pipe(takeWhile(x => x !== -1), map(x => {
            t.is(x.server.socket.readyState, WebSocket.OPEN);
        }));

        let wholeSequence = concat(connIsAliveHere, timer(100), makeSureConnIsDead);
        return wholeSequence;
    });
});

function isWampusNetErr(err : any, msgSubstring : string) {
    return err instanceof WampusNetworkError && err.message.includes(msgSubstring);
}

describe("failure", test => {
    describe("bad url", test => {
        let getTransport = (url, timeout?, serializer?) => {
            return fromPromise(WebsocketTransport.create({
                url,
                serializer : serializer || new JsonSerializer(),
                timeout
            }));
        };
        test.serial("non-existent", async t => {
            let conn = getTransport("http://www.aaaaaaaaaa123124.com");
            await t.throws(conn.pipe(delay(100), take(1)).toPromise(), x => isWampusNetErr(x, "ENOTFOUND"));
        });

        test.serial("malformed", async t => {
            let conn = getTransport("ff44");
            await t.throws(conn.pipe(take(1)).toPromise(), x => isWampusNetErr(x, "Invalid URL"));
        });

        test.serial("refused", async t => {
            let conn = getTransport("http://localhost:19413");
            await t.throws(conn.pipe(delay(100), take(1)).toPromise(), x => isWampusNetErr(x, "REFUSED"));
        });

        test.serial("invalid timeout", async t=> {
            let conn = getTransport(url, "hi");
            await t.throws(conn.pipe(take(1)).toPromise(), x => x instanceof WampusError && x.message.includes("Timeout value"));
        });

        test.serial("invalid serializer", async t => {
            let conn = getTransport(url, 1000, "asd");
            await t.throws(conn.pipe(take(1)).toPromise(), x => x instanceof WampusError && x.message.includes("Serializer"));
        });

    });
});

describe("receive", (test) => {
   test.serial("Receive one", t => {
       let conns = acquireConnections().pipe(flatMap(({client,server}) => {
           let msgs = client.events;
           let obj = {
               a : 1
           };
           let sending$ = sendObj$(server.socket, obj);
           return merge(sending$, msgs.pipe(take(1))).pipe(map((x : TransportEvent) => {
               t.is(x.type, "message");
               t.deepEqual(x.data, obj);
           }))
       }));
       return conns.pipe(takeUntil(timer(500)));
   });

   test.serial("Receive seq", t => {
       let conns = acquireConnections().pipe(flatMap(({client,server}) => {
           let msgs = client.events;
           let obj = {
               a : 1
           };
           let sending$ = sendObj$(server.socket, obj);
           return merge(sending$, msgs.pipe(take(1))).pipe(map((x : TransportEvent) => {
               t.is(x.type, "message");
               t.deepEqual(x.data, obj);
           }));
       }));
       return conns.pipe(takeUntil(timer(500)));
   });
});


export const info = {
    host: "localhost",
    port: 9385
} as ServerOptions;

export const url = `http://${info.host}:${info.port}`;

let _ws: Server;

export function wsTransport(t) {
    return WebsocketTransport.create({
        url: `http://${info.host}:${info.port}`,
        serializer: new JsonSerializer(),
        timeout: t
    });
}

export function connection(): Observable<{ socket: WebSocket, req: IncomingMessage }> {
    let firstConnection = fromEvent(_ws, "connection", (socket, req) => {
        return {socket, req};
    }).pipe(take(1));

    return concat(firstConnection, NEVER);
}

export function nextJson(socket: WebSocket): Observable<any> {
    let msgs = fromEvent(socket, "message", ({data}, type) => {
        let decoded: string;
        if (data instanceof Buffer) {
            decoded = data.toString("utf8");
        } else {
            decoded = data;
        }
        let parsed = JSON.parse(decoded);
        return parsed;
    });
    return msgs.pipe(take(1));
}

test.before(async () => {
    _ws = new Server(info);
    return _ws;
});