import test from "ava";
import {take} from "rxjs/operators";
import {getTransportAndServerConn, rxjsWsServer} from "~test/helpers/ws-server";

import {choose} from "~lib/utils/rxjs-operators";
import {WampusNetworkError} from "~lib/core/errors/types";
import {timer} from "rxjs";
import sinon from "sinon";
import {JsonSerializer} from "~lib/core/serializer/json";

import WebSocket from "isomorphic-ws";
import {WebsocketTransport} from "~lib/core/transport/websocket";

test.afterEach(() => {
    sinon.restore();
});

test("acuire", async t => {
    let {server, client} = await getTransportAndServerConn();
    t.is(server.readyState, WebSocket.OPEN);
});


test("stays open", async t => {
    let {server, client} = await getTransportAndServerConn();
    await timer(1000).toPromise();
    t.is(server.readyState, WebSocket.OPEN);
});

test("closes from client-side", async t => {
    let {server, client} = await getTransportAndServerConn();
    await timer(1000).toPromise();
    await client.close();
    t.true([WebSocket.CLOSED, WebSocket.CLOSING].includes(server.readyState));
    t.false(client.isActive);
});

test("sync closes from client side", async t => {
    let {server, client} = await getTransportAndServerConn();
    let p = client.close();
    t.false(client.isActive);
    let err = await t.throwsAsync(client.send$({}).toPromise());
    t.assert(err instanceof WampusNetworkError);
    t.assert(err.message.includes("closed"));
});

test("closes from server-side", async t => {
    let {server, client} = await getTransportAndServerConn();
    t.true(client.isActive);
    t.is(server.readyState, WebSocket.OPEN);
    let closeEvent = client.events$.pipe(choose(x => x.type === "closed" ? x : undefined), take(1)).toPromise();
    server.close();
    let ev = await closeEvent;
    t.is(ev.type, "closed");
});

test("close xN, get same promise", async t => {
    let {server, client} = await getTransportAndServerConn();
    let close1 = client.close();
    let close2 = client.close();
    t.true(close1 === close2);
    await close1;
    t.is(client.isActive, false);
    await timer(1000).toPromise();
    let close3 = client.close();
    t.true(close3 === close2);
});

test("connected transport properties", async t => {
    let {server, client} = await getTransportAndServerConn();
    t.is(client.name, "websocket.json");
});
