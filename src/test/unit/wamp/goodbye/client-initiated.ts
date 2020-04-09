import test from "ava";

import {WampusNetworkError} from "~lib/core/errors/types";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {WampType} from "typed-wamp";
import {MessageFactory} from "~lib/core/protocol/factory";
import {throwError, timer} from "rxjs";
import {timeoutWith} from "rxjs/operators";
import {fromPromise} from "rxjs/internal-compatibility";
import {monitor} from "~test/helpers/rxjs-monitor";

test("when goodbye received, should disconnect and close", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    let pGoodbye = session.close();
    let nextMessage = await sbs.next();
    t.deepEqual(nextMessage.data, [6, {}, "wamp.close.goodbye_and_out"]);
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    let next = await sbs.next();
    await t.notThrowsAsync(pGoodbye);
    t.is(next.type, "closed");
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes

});

test("will allow abrupt disconnect during goodbye", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let pGoodbye = session.close();
    await timer(100).toPromise();
    server.close();
    await t.notThrowsAsync(pGoodbye);
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes

});

const factory = new MessageFactory({
    reqId() {
        return (Math.random() * 10000) | 0;
    }
});
test("random messages should be allowed during goodbye", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let pGoodbye = session.close();
    await timer(20).toPromise();
    server.send(factory.error(WampType.INVOCATION, 0, {}, "").toRaw());
    await t.throwsAsync(fromPromise(pGoodbye).pipe(timeoutWith(20, throwError(new Error()))).toPromise());
    server.send([3, {}, "waaa"]);
    await t.notThrowsAsync(pGoodbye);
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes

});

test("when abort received, should disconnect and close", async t => {
    // TODO: Do something when goodbye violates protocol
    let {session, server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    let pGoodbye = session.close();
    await sbs.next();
    server.send([3, {}, "waaa"]);
    let next = await sbs.next();
    await t.notThrowsAsync(pGoodbye);
    t.is(next.type, "closed");
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes

});

test("when nothing received after timeout, should disconnect and close", async t => {
    // TODO: Do something when goodbye violates protocol
    let {session, server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    // tslint:disable-next-line:no-floating-promises
    session.close();
    let goodbye = await sbs.next();
    await timer(1500).toPromise();
    t.is((await sbs.next()).type, "closed");
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes

});

test("when server disconnects abruptly, should close", async t => {
    // TODO: Do something when goodbye violates protocol
    let {session, server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    let p = session.close();
    let goodbye = await sbs.next();
    server.close();
    await p;
    t.pass();
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes

});

test("when server errors, should close", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    let closing = session.close();
    let goodbye = await sbs.next();
    // TODO: Do something with an error in closing process
    server.error(new WampusNetworkError("Blah!"));
    await t.notThrowsAsync(closing);
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes

});
