import test from "ava";

import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {timer} from "rxjs";
import {monitor} from "~test/helpers/rxjs-monitor";

test("when receive goodbye, send goodbye and close+disconnect", async t => {
    let {server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    let goodbye = await sbs.next();
    t.is(goodbye.data[0], 6);
    t.is(goodbye.data[2], "wamp.close.goodbye_and_out");
    let close = await sbs.next();
    t.is(close.type, "closed");
});

test("when received abort, close+disconnect", async t => {
    // TODO: Do something when ABORT received
    let {server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    server.send([3, {}, "wamp.close.goodbye_and_out"]);
    let close = await sbs.next();
    t.is(close.type, "closed");
});

test("when received sudden disconnect, should close", async t => {
    // TODO: Do something when ABORT received
    let {session, server} = await SessionStages.handshaken("a");
    server.close();
    await timer(30).toPromise();
    t.is(session.isActive, false);
});

// TODO: Some kind of test for connections that error

