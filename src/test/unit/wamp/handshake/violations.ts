import test from "ava";
import {SessionStages} from "~test/helpers/dummy-session";
import {WampRaw, WampType, WampUri} from "typed-wamp";
import {MatchError} from "~test/helpers/errors";
import {monitor} from "~test/helpers/monitored-observable";

test("receive CALL, proto violation, abort - existing route throws error", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let monitored = monitor(server.messages);
    const callTicketShouldFail = t.throwsAsync(session.call({
        name: "abc"
    }).progress.toPromise());
    await monitored.next(); // skip the CALL message
    server.send([WampType.CALL]);
    let abort = await monitored.next() as WampRaw.Abort;
    t.assert(abort[1].message.includes("CALL"));
    t.assert(abort[1].message.includes("meant for routers"));
    const err = await callTicketShouldFail;
    t.assert(MatchError.network("While calling procedure", "abc", "session", "closed")(err));
    t.falsy(await monitored.nextWithin(1)); // transport was closed
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes
});

test("receive WELCOME, proto violation, abort - existing route throws error", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let monitored = monitor(server.messages);
    let sess = await session;
    const callTicketShouldFail = t.throwsAsync(sess.call({
        name: "abc"
    }).progress.toPromise());
    await monitored.next(); // skip the CALL message
    server.send([WampType.WELCOME]);
    const abort = await monitored.next();
    t.deepEqual(abort, [WampType.ABORT, abort[1], WampUri.Error.ProtoViolation]);
    const err = await callTicketShouldFail;
    t.assert(MatchError.network("While calling procedure", "abc", "session", "closed")(err));
    t.falsy(await monitored.nextWithin(1)); // transport was closed
    t.deepEqual(session.protocol._router.matchAll(), []); // no outstanding routes
});
