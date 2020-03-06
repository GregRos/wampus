/* tslint:disable:object-literal-shorthand */
import test from "ava";

import {rewiremock} from "~test/helpers/rewiremock";
import {JsonSerializer} from "~lib/core/serializer/json";
import WebSocket from "isomorphic-ws";
import {timer} from "rxjs";
import {WampusNetworkError} from "~lib/core/errors/types";
import {EventTarget} from "event-target-shim";
import {EventEmitter} from "events";
import {take} from "rxjs/operators";

function getModuleWithPatchedWs(alt: () => void): Promise<typeof import("~lib/core/transport/websocket")> {
    return rewiremock.proxy(() => require("~lib/core/transport/websocket"), r => {
        return {
            "isomorphic-ws": Object.assign(alt, WebSocket)
        };
    });
}

function eventTargetStub() {
    return new EventEmitter();
}

function wrapCtor<T>(x: T) {
    return function() {
        return x;
    };
}

async function getCommonTransport(obj: any, timeout = 50) {
    const {WebsocketTransport} = await getModuleWithPatchedWs(wrapCtor(obj));
    const conn = WebsocketTransport.create({
        timeout,
        serializer: new JsonSerializer(),
        url: "ws://localhost:3000"
    });
    return conn;
}

test("WS connect timeout", async t => {
    const z = getCommonTransport(eventTargetStub());
    const err = await t.throwsAsync(z);
    t.true(err instanceof WampusNetworkError);
    t.assert(err.message.includes("timed out"));
});


test("WS error during open", async t => {
    const stub: EventEmitter = eventTargetStub();
    const wsPromise = getCommonTransport(stub);
    timer(1).subscribe(() => {
        stub.emit("error", new Error("aaaa"));
    });
    const err = await t.throwsAsync(wsPromise);
    t.true(err instanceof WampusNetworkError);
    t.true((err as any).innerError instanceof Error);
    t.assert(err.message.match(/Failed to establish websocket.*aaaa/i));
});

test("WS error after open", async t => {
    const stub: EventEmitter = eventTargetStub();
    timer(1).subscribe(() => {
        stub.emit("open");
    });
    const transport = await getCommonTransport(stub);
    const firstMessage$ = transport.events$.pipe(take(1));
    timer(10).subscribe(() => {
        stub.emit("error", new Error("aaaa"));
    });
    const err = await t.throwsAsync(firstMessage$.toPromise());
    t.assert(err instanceof WampusNetworkError);
    t.assert(err.message.match(/closed with an error.*aaaa/i));
});
