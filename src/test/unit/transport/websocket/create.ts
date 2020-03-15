import {WebsocketTransport} from "~lib/core/transport/websocket";
import {JsonSerializer} from "~lib/core/serializer/json";
import {WampusError, WampusInvalidArgument, WampusNetworkError} from "~lib/core/errors/types";
import test from "ava";
import {getCommonTransport} from "~test/helpers/create-mocked-ws-transport";

let getTransport = (url, timeout?, serializer?) => {
    return WebsocketTransport.create({
        url,
        serializer: serializer || new JsonSerializer(),
        timeout
    });
};

test("url non-existent", async t => {
    let conn = getCommonTransport({
        url: null
    });
    let err = await t.throwsAsync(conn.transport);
    t.assert(err instanceof WampusInvalidArgument);
});

test("invalid timeout", async t => {
    let {transport} = getCommonTransport({
        timeout: "abc" as any
    });
    let err = await t.throwsAsync(transport);
    t.assert(err instanceof WampusInvalidArgument);
});

test("invalid serializer", async t => {
    let {transport} = getCommonTransport({
        serializer: "asdsd" as any
    });
    let err = await t.throwsAsync(transport);
    t.assert(err instanceof WampusInvalidArgument);
});