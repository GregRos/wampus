import test from "ava";

import {WebsocketTransport} from "../../../../lib/core/transport/websocket";
import {JsonSerializer} from "../../../../lib/core/serializer/json";
import * as ws from "ws";
import {MatchError} from "../../../helpers/errors";
import {concat, defer, fromEvent, merge, NEVER, Observable, range, timer, zip} from "rxjs";
import {
    buffer,
    bufferCount,
    delay, filter,
    first,
    flatMap,
    map,
    mapTo,
    take,
    takeUntil,
    takeWhile,
    tap,
    timeout
} from "rxjs/operators";
import {ServerOptions} from "ws";
import {Server} from "ws";
import {IncomingMessage} from "http";
import WebSocket = require("ws");
import {WampusError, WampusNetworkError} from "../../../../lib/core/errors/types";
import {TransportEvent} from "../../../../lib/core/transport/transport";
import {fromPromise} from "rxjs/internal-compatibility";
import {getTransportAndServerConn, receiveObjects$, rxjsWsServer, sendVia} from "../../../helpers/ws-server";
import {MyPromise} from "../../../../lib/utils/ext-promise";
import _ = require("lodash");
import {choose} from "../../../../lib/utils/rxjs";

test("acuire", async t => {
    let {server,client} = await getTransportAndServerConn();
    t.is(server.readyState, WebSocket.OPEN);
});


test("stays open", async t => {
    let {server,client} = await getTransportAndServerConn();
    await MyPromise.wait(1000);
    t.is(server.readyState, WebSocket.OPEN);
});

test("closes from client-side", async t => {
    let {server, client} = await getTransportAndServerConn();
    await MyPromise.wait(1000);
    await client.close();
    t.true([WebSocket.CLOSED, WebSocket.CLOSING].includes(server.readyState));
    t.false(client.isActive);
});

test("sync closes from client side", async t => {
    let {server, client} = await getTransportAndServerConn();
    let p = client.close();
    t.false(client.isActive);
    await t.throws(client.send$({}).toPromise(), MatchError.network("closed"));
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
    await MyPromise.wait(1000);
    let close3 = client.close();
    t.true(close3 === close2);
});