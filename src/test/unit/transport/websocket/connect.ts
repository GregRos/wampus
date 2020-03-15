import test from "ava";
import {take} from "rxjs/operators";
import {getTransportAndServerConn} from "~test/helpers/ws-server";

import {choose} from "~lib/utils/rxjs-operators";
import {WampusNetworkError} from "~lib/core/errors/types";
import {timer} from "rxjs";

import WebSocket from "isomorphic-ws";
import {Rxjs} from "~test/helpers/observable-monitor";

test("acquire", async t => {
    let {
        transport
    } = await getTransportAndServerConn();
    t.is((await transport).location, "ws://localhost:3000");
});


test("closes from client-side", async t => {
    let {
        transport,
        ws
    } = await getTransportAndServerConn();
    await timer(1000).toPromise();
    transport.close();
    const next = await ws.out.next();
    t.is(next.event, "close");
    t.false(transport.isActive);
});

test("sync closes from client side", async t => {
    let {transport} = await getTransportAndServerConn();
    // tslint:disable-next-line:no-floating-promises
    transport.close();
    t.false(transport.isActive);
    let err = await t.throwsAsync(transport.send$({}).toPromise());
    t.assert(err instanceof WampusNetworkError);
    t.assert(err.message.includes("closed"));
});

test("closes from server-side", async t => {
    let {ws, transport} = await getTransportAndServerConn();
    t.true(transport.isActive);
    let closeEvent = transport.events$.pipe(choose(x => x.type === "closed" ? x : undefined), take(1)).toPromise();
    ws.in.next({
        event: "close"
    });
    let ev = await closeEvent;
    t.is(ev.type, "closed");
});

test("close xN, get same promise", async t => {
    let {transport} = await getTransportAndServerConn();
    let close1 = transport.close();
    let close2 = transport.close();
    t.true(close1 === close2);
    await close1;
    t.is(transport.isActive, false);
    await timer(1000).toPromise();
    let close3 = transport.close();
    t.true(close3 === close2);
});

test("connected transport properties", async t => {
    let {transport} = await getTransportAndServerConn();
    t.is(transport.name, "websocket.json");
});
