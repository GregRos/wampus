/* tslint:disable:object-literal-shorthand */
import test from "ava";

import {rewiremock} from "~test/helpers/rewiremock";
import {JsonSerializer} from "~lib/core/serializer/json";
import WebSocket from "isomorphic-ws";
import {Subject, timer} from "rxjs";
import {WampusNetworkError} from "~lib/core/errors/types";
import {EventEmitter} from "events";
import {take} from "rxjs/operators";
import {WebSocket as WS} from "mock-socket";
import {getCommonTransport, getModuleWithPatchedWs} from "~test/helpers/create-mocked-ws-transport";
import {InputEvent, MockWebsocket} from "~test/helpers/mock-ws";

test("WS connect timeout", async t => {
    const z = getCommonTransport({
        timeout: 100
    });
    const err = await t.throwsAsync(z.transport);
    t.true(err instanceof WampusNetworkError);
    t.assert(err.message.includes("timed out"));
});


test("WS error during open", async t => {
    const {
        ws,
        transport
    } = getCommonTransport();
    timer(1).subscribe(() => {
        ws.in.next({
            event: "error",
            data: new Error("aaaa")
        });
    });
    const err = await t.throwsAsync(transport);
    t.true(err instanceof WampusNetworkError);
    t.true((err as any).innerError instanceof Error);
    t.assert(err.message.match(/Failed to establish websocket.*aaaa/i));
});

test("WS error after open", async t => {
    const {
        transport,
        ws
    } = getCommonTransport();
    ws.in.next({
        event: "open"
    });
    const firstMessage$ = (await transport).events$.pipe(take(1));
    timer(10).subscribe(() => {
        ws.in.next({
            event: "error",
            data: new Error("aaaa")
        });
    });
    const err = await t.throwsAsync(firstMessage$.toPromise());
    t.assert(err instanceof WampusNetworkError);
    t.assert(err.message.match(/closed with an error.*aaaa/i));
});
