/* tslint:disable:object-literal-shorthand */
import test from "ava";

import {rewiremock} from "~test/helpers/rewiremock";
import {JsonSerializer} from "~lib/core/serializer/json";
import WebSocket from "isomorphic-ws";
import {timer} from "rxjs";
import {WampusNetworkError} from "~lib/core/errors/types";
import {EventTarget} from "event-target-shim";
import {EventEmitter} from "events";
function getModuleWithPatchedWs(alt: () => void) {
    return rewiremock.proxy(() => require("~lib/core/transport/websocket"), r => {
        return {
            "isomorphic-ws": Object.assign(alt, WebSocket)
        };
    });
}

const eventTargetStub = () => {
    return new EventEmitter();
};

test("connection timeout", async t => {
    const { WebsocketTransport } = await getModuleWithPatchedWs(() => eventTargetStub());
    const z = WebsocketTransport.create$({
        timeout: 50,
        serializer: new JsonSerializer(),
        url: "ws://localhost:3000"
    });

    const err = await t.throwsAsync(z);
    t.true(err instanceof WampusNetworkError);
});

test("ws error", async t => {
    const stub: any = eventTargetStub();
    const { WebsocketTransport } = await getModuleWithPatchedWs(() => stub);
    const wsPromise = WebsocketTransport.create$({
        timeout: 50,
        serializer: new JsonSerializer(),
        url: "ws://localhost:3000"
    });

    timer(1).subscribe(() => {
        stub.onerror(new Error("err"));
    });
    const err = await t.throwsAsync(wsPromise);

    t.true(err instanceof WampusNetworkError);
});