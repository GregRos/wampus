import test from "ava";
import {first} from "rxjs/operators";
import {wampusHelloDetails} from "../../../lib/core/hello-details";
import {isWampusIllegalOperationError, isWampusNetErr} from "../../helpers/misc";
import {WampusNetworkError} from "../../../lib/errors/types";
import {Shorthand} from "../../helpers/wamp";

test("HELLO is okay", async t => {
    let {server,session} = Shorthand.getSessionNoHandshakeYet("a");
    let hello =  await server.messages.pipe(first()).toPromise();
    t.deepEqual(await hello, [1, "a", wampusHelloDetails]);
});

test("send HELLO, when received ABORT(No such realm), throw error", async t => {
    let {server,session} = Shorthand.getSessionNoHandshakeYet("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.no_such_realm"]);
    await t.throws(session, isWampusIllegalOperationError("Tried to join realm"))
});

test("sned HELLO, when received ABORT (Proto violation), throw error", async t => {
    let {server,session} = Shorthand.getSessionNoHandshakeYet("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.protocol_violation"]);
    await t.throws(session, isWampusNetErr("Protocol violation"))
});

test("send HELLO, when received ABORT (other), throw error", async t => {
    let {server,session} = Shorthand.getSessionNoHandshakeYet("a");
    await server.messages.pipe(first()).toPromise();
    server.send([3, {}, "wamp.error.abc"]);
    await t.throws(session, isWampusIllegalOperationError("wamp.error.abc", "ABORT", "handshake"))
});

test("send HELLO, when received non-handshake message, throw error", async t => {
    let {server,session} = Shorthand.getSessionNoHandshakeYet("a");
    await server.messages.pipe(first()).toPromise();
    server.send([1, {}, "hi"]);
    await t.throws(session, isWampusNetErr("Protocol violation", "During handshake", "HELLO"));
});

test("send hello, when received abrupt disconnect, throw error", async t => {
    let {server,session} = Shorthand.getSessionNoHandshakeYet("a");
    await server.messages.pipe(first()).toPromise();
    server.close();
    await t.throws(session, isWampusNetErr("connection abruptly closed"));
});

test("send hello, when received connection error, throw error", async t => {
    let {server,session} = Shorthand.getSessionNoHandshakeYet("a");
    await server.messages.pipe(first()).toPromise();
    let err = new WampusNetworkError("ERROR! abcd")
    server.error(err);
    await t.throws(session, "ERROR! abcd");
});

test("send HELLO, when receive WELCOME, session should have received data", async t => {
    let {server, session} = Shorthand.getSessionNoHandshakeYet("a");
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

test("send HELLO, when received CHALLENGE, throw error (not supported)", async t => {
    let {server, session} = Shorthand.getSessionNoHandshakeYet("a");
    await server.messages.pipe(first()).toPromise();
    server.send([4, "blah", {}]);
    await t.throws(session, isWampusIllegalOperationError("Doesn't support", "feature", "CHALLENGE"))
});

// TODO: Test -- Integration: Disconnect during/before handshake

