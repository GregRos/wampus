import {WebsocketTransport} from "../../../../lib/core/transport/websocket";
import {JsonSerializer} from "../../../../lib/core/serializer/json";
import {rxjsWsServer} from "../../../helpers/ws-server";
import {WampusError} from "../../../../lib/core/errors/types";
import {MatchError} from "../../../helpers/errors";
import test from "ava";

let getTransport = (url, timeout?, serializer?) => {
    return WebsocketTransport.create({
        url,
        serializer : serializer || new JsonSerializer(),
        timeout
    })
};
test("url non-existent", async t => {
    let conn = getTransport("http://www.aaaaaaaaaa123124.com");
    await t.throws(conn, MatchError.network("ENOTFOUND"));
});

test("url malformed", async t => {
    let conn = getTransport("ff44");
    await t.throws(conn, MatchError.network("Invalid URL"));
});

test("connection refused", async t => {
    let conn = getTransport("http://localhost:19413");
    await t.throws(conn, MatchError.network("REFUSED"));
});

test("invalid timeout", async t=> {
    let conn = getTransport(await rxjsWsServer.then(x => x.url), "hi");
    await t.throws(conn, x => x instanceof WampusError && x.message.includes("Timeout value"));
});

test("invalid serializer", async t => {
    let conn = getTransport(await rxjsWsServer.then(x => x.url), 1000, "asd");
    await t.throws(conn, x => x instanceof WampusError && x.message.includes("Serializer"));
});
