import test from "ava";

import {WebsocketTransport} from "../../../../lib/core/messaging/transport/websocket";
import {JsonSerializer} from "../../../../lib/core/messaging/serializer/json";
import * as ws from "ws";
import {isWampusNetErr} from "../../../helpers/misc";
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
import {WampusError, WampusNetworkError} from "../../../../lib/errors/types";
import {TransportEvent} from "../../../../lib/core/messaging/transport/transport";
import {fromPromise} from "rxjs/internal-compatibility";
import {getTransportAndServerConn, receiveObjects$, rxjsWsServer, sendVia} from "../../../helpers/ws-server";
import {MyPromise} from "../../../../lib/ext-promise";
import _ = require("lodash");
import {choose} from "../../../../lib/utils/rxjs";


test("acquire", async t => {
    let {servConn,clientConn} = await getTransportAndServerConn();
    t.is(servConn.readyState, WebSocket.OPEN);
});


test("stays open", async t => {
    let {servConn,clientConn} = await getTransportAndServerConn();
    await MyPromise.wait(1000);
    t.is(servConn.readyState, WebSocket.OPEN);
});

test("closes from client-side", async t => {
    let {servConn, clientConn} = await getTransportAndServerConn();
    await MyPromise.wait(1000);
    await clientConn.close();
    t.true([WebSocket.CLOSED, WebSocket.CLOSING].includes(servConn.readyState));
    t.false(clientConn.isActive);
});

test("sync closes from client side", async t => {
    let {servConn, clientConn} = await getTransportAndServerConn();
    let p = clientConn.close();
    t.false(clientConn.isActive);
    await t.throws(clientConn.send$({}).toPromise(), isWampusNetErr("closed"));
});

test("closes from server-side", async t => {
    let {servConn, clientConn} = await getTransportAndServerConn();
    t.true(clientConn.isActive);
    t.is(servConn.readyState, WebSocket.OPEN);
    let closeEvent = clientConn.events.pipe(choose(x => x.type === "closed" ? x : undefined), take(1)).toPromise();
    servConn.close();
    let ev = await closeEvent;
    t.is(ev.type, "closed");
});

test("close xN, get same promise", async t => {
    let {servConn, clientConn} = await getTransportAndServerConn();
    let close1 = clientConn.close();
    let close2 = clientConn.close();
    t.true(close1 === close2);
    await close1;
    t.is(clientConn.isActive, false);
    await MyPromise.wait(1000);
    let close3 = clientConn.close();
    t.true(close3 === close2);
});