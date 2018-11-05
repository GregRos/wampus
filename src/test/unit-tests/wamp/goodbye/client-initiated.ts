import test, {GenericTest, GenericTestContext} from "ava";
import {first} from "rxjs/operators";
import {MyPromise} from "../../../../lib/utils/ext-promise";
import {WampusCoreSession} from "../../../../lib/core/session/core-session";
import {MatchError} from "../../../helpers/errors";
import {WampusNetworkError} from "../../../../lib/core/errors/types";
import {SessionStages} from "../../../helpers/dummy-session";
import {Rxjs} from "../../../helpers/observable-monitor";
import {WampType} from "../../../../lib/core/protocol/message.type";
import {MessageFactory} from "../../../../lib/core/protocol/factory";
import {Operators} from "promise-stuff";


async function isSessionClosed<T>(t : GenericTestContext<T>, session : WampusCoreSession) {
    t.is(session.isActive, false);
    await t.throws(session.call({name : "ab"}).progress.toPromise(), MatchError.network("closed"));
    await t.throws(session.register({name : "ab"}), MatchError.network("closed"));
    await t.throws(session.topic({name : "ab"}), MatchError.network("closed"));
    await t.throws(session.publish({name : "ab"}), MatchError.network("closed"));

    //closing okay should be fine:
    await t.notThrows(session.close());
}

test("when goodbye received, should disconnect and close", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let pGoodbye = session.close();
    let nextMessage = await sbs.next();
    t.deepEqual(nextMessage.data, [6, {}, "wamp.close.goodbye_and_out"]);
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    let next = await sbs.next();
    await t.notThrows(pGoodbye);
    t.is(next.type, "closed");
});

test("will allow abrupt disconnect during goodbye", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let pGoodbye = session.close();
    await MyPromise.wait(100);
    server.close();
    await t.notThrows(pGoodbye);
});

const factory = new MessageFactory({
    requestId() {
        return (Math.random() * 10000) | 0;
    }
});
test("random messages should be allowed during goodbye", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let pGoodbye = session.close();
    await MyPromise.wait(20);
    server.send(factory.error(WampType.INVOCATION, 0, {}, "").toTransportFormat());
    await t.throws(Operators.timeout(pGoodbye, 20));
    server.send([3, {}, "waaa"]);
    await t.notThrows(pGoodbye);
});

test("when abort received, should disconnect and close", async t => {
    //TODO: Do something when goodbye violates protocol
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let pGoodbye = session.close();
    await sbs.next();
    server.send([3, {}, "waaa"]);
    let next = await sbs.next();
    await t.notThrows(pGoodbye);
    t.is(next.type, "closed");
});

test("when abort received, should disconnect and close", async t => {
    //TODO: Do something when goodbye violates protocol
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let pGoodbye = session.close();
    await sbs.next();
    server.send([3, {}, "waaa"]);
    let next = await sbs.next();
    await t.notThrows(pGoodbye);
    t.is(next.type, "closed");
});

test("when nothing received after timeout, should disconnect and close", async t => {
    //TODO: Do something when goodbye violates protocol
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    session.close();
    let goodbye = await sbs.next();
    await MyPromise.wait(1500);
    t.is((await sbs.next()).type, "closed");
});

test("when server disconnects abruptly, should close", async t => {
    //TODO: Do something when goodbye violates protocol
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let p = session.close();
    let goodbye = await sbs.next();
    server.close();
    await p;
    t.pass();
});

test("when server errors, should close", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let closing = session.close();
    let goodbye = await sbs.next();
    //TODO: Do something with an error in closing process
    server.error(new WampusNetworkError("Blah!"));
    await t.notThrows(closing);
});