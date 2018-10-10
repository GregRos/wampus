import test, {GenericTest, GenericTestContext} from "ava";
import {first} from "rxjs/operators";
import {MyPromise} from "../../../../lib/ext-promise";
import {Session} from "../../../../lib/core/session";
import {isWampusNetErr} from "../../../helpers/misc";
import {WampusNetworkError} from "../../../../lib/errors/types";
import {Shorthand} from "../../../helpers/wamp";


async function isSessionClosed<T>(t : GenericTestContext<T>, session : Session) {
    t.is(session.isActive, false);
    await t.throws(session.call({name : "ab"}).progress.toPromise(), isWampusNetErr("closed"));
    await t.throws(session.register({name : "ab"}), isWampusNetErr("closed"));
    await t.throws(session.event({name : "ab"}), isWampusNetErr("closed"));
    await t.throws(session.publish({name : "ab"}), isWampusNetErr("closed"));

    //closing okay should be fine:
    await t.notThrows(session.close());
}

test("when goodbye received, should disconnect and close", async t => {
    let {session,server} = await Shorthand.getSessionPostHandshake("a");
    let sbs = Shorthand.stepListenObservable(server.events);
    let pGoodbye = session.close();
    let nextMessage = await sbs.next();
    t.deepEqual(nextMessage.data, [6, {}, "wamp.close.goodbye_and_out"]);
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    let next = await sbs.next();
    await t.notThrows(pGoodbye);
    t.is(next.type, "closed");
});

test("when abort received, should disconnect and close", async t => {
    //TODO: Do something when goodbye violates protocol
    let {session,server} = await Shorthand.getSessionPostHandshake("a");
    let sbs = Shorthand.stepListenObservable(server.events);
    let pGoodbye = session.close();
    await sbs.next();
    server.send([3, {}, "waaa"]);
    let next = await sbs.next();
    await t.notThrows(pGoodbye);
    t.is(next.type, "closed");
});

test("when nothing received after timeout, should disconnect and close", async t => {
    //TODO: Do something when goodbye violates protocol
    let {session,server} = await Shorthand.getSessionPostHandshake("a");
    let sbs = Shorthand.stepListenObservable(server.events);
    session.close();
    let goodbye = await sbs.next();
    await MyPromise.wait(1500);
    t.is((await sbs.next()).type, "closed");
});

test("when server disconnects abruptly, should close", async t => {
    //TODO: Do something when goodbye violates protocol
    let {session,server} = await Shorthand.getSessionPostHandshake("a");
    let sbs = Shorthand.stepListenObservable(server.events);
    let p = session.close();
    let goodbye = await sbs.next();
    server.close();
    await p;
    t.pass();
});

test("when server errors, should close", async t => {
    let {session,server} = await Shorthand.getSessionPostHandshake("a");
    let sbs = Shorthand.stepListenObservable(server.events);
    let closing = session.close();
    let goodbye = await sbs.next();
    //TODO: Do something with an error in closing process
    server.error(new WampusNetworkError("Blah!"));
    await t.notThrows(closing);
});