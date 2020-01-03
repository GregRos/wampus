import test from "ava";
import {first} from "rxjs/operators";
import {wampusHelloDetails} from "../../../../lib/core/hello-details";
import {MatchError} from "../../../helpers/errors";
import {WampusNetworkError} from "../../../../lib/core/errors/types";
import {SessionStages} from "../../../helpers/dummy-session";

test("HELLO is okay", async t => {
    let {server, session} = SessionStages.fresh("a");
    let hello = await server.messages.pipe(first()).toPromise();
    t.deepEqual(await hello, [1, "a", wampusHelloDetails]);
});

test("send HELLO, when received ABORT(No such realm), throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.no_such_realm"]);
    let err = await t.throwsAsync(session);
    t.true(MatchError.illegalOperation("Tried to join realm")(err));
});

test("sned HELLO, when received ABORT (Proto violation), throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.protocol_violation"]);
    let err = await t.throwsAsync(session);
    t.true(MatchError.network("Protocol violation")(err));
});

test("send HELLO, when received ABORT (other), throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.abc"]);
    let err = await t.throwsAsync(session);
    t.true(MatchError.illegalOperation("wamp.error.abc", "ABORT", "handshake")(err));
});

test("send HELLO, when received non-handshake message, throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.send([1, {}, "hi"]);
    let err = await t.throwsAsync(session);
    t.true(MatchError.network("During handshake", "HELLO")(err));
});

test("send hello, when received abrupt disconnect, throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.close();
    let err = await t.throwsAsync(session);
    t.true(MatchError.network("the transport abruptly closed")(err));
});

test("send hello, when received connection error, throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    let err = new WampusNetworkError("ERROR! abcd");
    server.error(err);
    await t.throwsAsync(session, "ERROR! abcd");
});

test("send HELLO, when receive WELCOME, session should have received data", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    let wDetails = {
        roles: {
            broker: {},
            dealer: {}
        }
    };
    server.send([2, 123, wDetails]);
    let s = await session;
    t.true(s.isActive);
    t.is(s.sessionId, 123);
    t.is(s.realm, "a");
    t.deepEqual(s.details, wDetails);
});

// TODO: Make sure no extra messages are sent to the server

// TODO: Make sure routes get cleared up and don't cause memory leaks

// TODO: Make sure there are no leaks in general


// TODO: Test -- Integration: Transport issues

