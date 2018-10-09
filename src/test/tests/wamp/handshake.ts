import test from "ava";
import {first} from "rxjs/operators";
import {wampusHelloDetails} from "../../../lib/core/hello-details";
import {isWampusIllegalOperationError, isWampusNetErr} from "../../helpers/misc";
import {WampusNetworkError} from "../../../lib/errors/types";
import {createSession} from "../../helpers/wamp";

test("send HELLO", async t => {
    let {server,session} = createSession("a");
    let hello =  await server.messages.pipe(first()).toPromise();
    t.deepEqual(await hello, [1, "a", wampusHelloDetails]);
});

test("receive ABORT(No such realm)", async t => {
    let {server,session} = createSession("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.no_such_realm"]);
    await t.throws(session, isWampusIllegalOperationError("Tried to join realm"))
});

test("receive ABORT (Proto violation)", async t => {
    let {server,session} = createSession("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.protocol_violation"]);
    await t.throws(session, isWampusNetErr("Protocol violation"))
});

test("receive ABORT (other)", async t => {
    let {server,session} = createSession("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.abc"]);
    await t.throws(session, isWampusIllegalOperationError("wamp.error.abc", "ABORT", "handshake"))
});

test("receive NON-HANDSHAKE", async t => {
    let {server,session} = createSession("a");
    await server.messages.pipe(first()).toPromise();
    server.send([1, {}, "hi"]);
    await t.throws(session, isWampusNetErr("Protocol violation", "During handshake", "HELLO"));
});

test("receive {DISCONNECT}", async t => {
    let {server,session} = createSession("a");
    await server.messages.pipe(first()).toPromise();
    server.close();
    await t.throws(session, isWampusNetErr("connection abruptly closed"));
});

test("receive {ERROR}", async t => {
    let {server,session} = createSession("a");
    await server.messages.pipe(first()).toPromise();
    let err = new WampusNetworkError("ERROR! abcd")
    server.error(err);
    await t.throws(session, "ERROR! abcd");
});

test("receive WELCOME", async t => {
    let {server, session} = createSession("a");
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
    t.is(s.id, 123);
    t.is(s.realm, "a");
    t.deepEqual(s.details, wDetails);
});

test("receive CHALLENGE; not supported", async t => {
    let {server, session} = createSession("a");
    await server.messages.pipe(first()).toPromise();
    server.send([4, "blah", {}]);
    await t.throws(session, isWampusIllegalOperationError("Doesn't support", "feature", "CHALLENGE"))
});

// TODO: Test -- Integration: Disconnect during/before handshake

