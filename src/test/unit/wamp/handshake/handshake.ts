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
    await t.throws(session, MatchError.illegalOperation("Tried to join realm"));
});

test("sned HELLO, when received ABORT (Proto violation), throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.protocol_violation"]);
    await t.throws(session, MatchError.network("Protocol violation"));
});

test("send HELLO, when received ABORT (other), throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.abc"]);
    await t.throws(session, MatchError.illegalOperation("wamp.error.abc", "ABORT", "handshake"));
});

test("send HELLO, when received non-handshake message, throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.send([1, {}, "hi"]);
    await t.throws(session, MatchError.network("During handshake", "HELLO"));
});

test("send hello, when received abrupt disconnect, throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    server.close();
    await t.throws(session, MatchError.network("the transport abruptly closed"));
});

test("send hello, when received connection error, throw error", async t => {
    let {server, session} = SessionStages.fresh("a");
    await server.messages.pipe(first()).toPromise();
    let err = new WampusNetworkError("ERROR! abcd");
    server.error(err);
    await t.throws(session, "ERROR! abcd");
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

