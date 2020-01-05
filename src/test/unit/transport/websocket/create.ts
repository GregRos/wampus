import {WebsocketTransport} from "../../../../lib/core/transport/websocket";
import {JsonSerializer} from "../../../../lib/core/serializer/json";
import {rxjsWsServer} from "../../../helpers/ws-server";
import {WampusError, WampusNetworkError} from "../../../../lib/core/errors/types";
import {MatchError} from "../../../helpers/errors";
import test from "ava";

let getTransport = (url, timeout?, serializer?) => {
    return WebsocketTransport.create({
        url,
        serializer: serializer || new JsonSerializer(),
        timeout
    });
};
test("url non-existent", async t => {
    let conn = getTransport("http://www.aaaaaaaaaa123124.com");
    let err = await t.throwsAsync(conn);
    t.assert(err instanceof WampusNetworkError);
});

test("url malformed", async t => {
    let conn = getTransport("ff44");
    let err = await t.throwsAsync(conn);
    t.assert(err instanceof WampusNetworkError);
});

test("connection refused", async t => {
    let conn = getTransport("http://localhost:19413");
    let err = await t.throwsAsync(conn);
    t.assert(err instanceof WampusNetworkError);
});

test("invalid timeout", async t => {
    let conn = getTransport(await rxjsWsServer.then(x => x.url), "hi");
    let err = await t.throwsAsync(conn);
    t.assert(err instanceof WampusError);
});

test("invalid serializer", async t => {
    let conn = getTransport(await rxjsWsServer.then(x => x.url), 1000, "asd");
    let err = await t.throwsAsync(conn);
    t.assert(err instanceof WampusError);
});
