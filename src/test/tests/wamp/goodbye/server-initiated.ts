import test, {GenericTest, GenericTestContext} from "ava";
import {first} from "rxjs/operators";
import {MyPromise} from "../../../../lib/ext-promise";
import {WampusSession} from "../../../../lib/core/session";
import {MatchError} from "../../../helpers/errors";
import {WampusNetworkError} from "../../../../lib/core/errors/types";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/rxjs";

test("when receive goodbye, send goodbye and close+disconnect", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    let goodbye = await sbs.next();
    t.is(goodbye.data[0], 6);
    t.is(goodbye.data[2], "wamp.close.goodbye_and_out");
    let close = await sbs.next();
    t.is(close.type, "closed");
});

test("when received abort, close+disconnect", async t => {
    //TODO: Do something when ABORT received
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    server.send([3, {}, "wamp.close.goodbye_and_out"]);
    let close = await sbs.next();
    t.is(close.type, "closed");
});

test("when received sudden disconnect, should close", async t => {
    //TODO: Do something when ABORT received
    let {session,server} = await SessionStages.handshaken("a");
    server.close();
    await MyPromise.wait(30);
    t.is(session.isActive, false);
});

//TODO: Some kind of test for connections that error


