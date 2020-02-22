/* tslint:disable:object-literal-shorthand */
import test from "ava";

import {rewiremock} from "~test/helpers/rewiremock";
import {JsonSerializer} from "~lib/core/serializer/json";
import WebSocket from "isomorphic-ws";
import {timer} from "rxjs";
import {WampusNetworkError} from "~lib/core/errors/types";

function getModuleWithPatchedWs(alt: () => void) {
    return rewiremock.proxy(() => require("~lib/core/transport/websocket"), r => {
        return {
            "isomorphic-ws": Object.assign(alt, WebSocket)
        };
    });
}

const stubWithEventListener = () => {
    return {
        addEventListener() {

        }
    }
};

test("connection timeout", async t => {
    const { WebsocketTransport } = await getModuleWithPatchedWs(() => stubWithEventListener());
    const z = WebsocketTransport.create$({
        timeout: 50,
        serializer: new JsonSerializer(),
        url: "ws://localhost:3000"
    });

    const err = await t.throwsAsync(z);
    t.true(err instanceof WampusNetworkError);
});

test("ws error", async t => {
    const stub: any = stubWithEventListener();
    const { WebsocketTransport } = await getModuleWithPatchedWs(() => stub);
    const wsPromise = WebsocketTransport.create$({
        timeout: 50,
        serializer: new JsonSerializer(),
        url: "ws://localhost:3000"
    });

    timer(0).subscribe(() => {
        stub.onerror(new Error("err"));
    });
    const err = await t.throwsAsync(wsPromise);

    t.true(err instanceof WampusNetworkError);
});