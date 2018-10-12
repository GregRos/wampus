import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {MatchError} from "../../../helpers/errors";
import {WampType} from "../../../../lib/protocol/message.type";
import {MyPromise} from "../../../../lib/ext-promise";
import {Rxjs} from "../../../helpers/rxjs";
import {Operators} from "promise-stuff";


async function cancelSession() {
    return await SessionStages.handshaken("a", {
            dealer: {
                call_cancelling : true
            }
        }
    );
}

test("when cancel unsupported, throw error", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let prog = session.call({
        name: "a",
        options: {}
    });
    await t.throws(prog.close(), MatchError.illegalOperation("CallCancelling"));
    let pending = prog.progress.toPromise();
    server.send([WampType.RESULT, prog.requestId, {}, [], {a: 1}]);
    t.deepEqual((await pending).kwargs, {a: 1});
});

test("should send CANCEL", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    //don't await close(), because it will expect a RESULT or ERROR from server.
    prog.close();
    let a  = await serverMonitor.next();
    let expectCancel = await serverMonitor.next();
    t.deepEqual(expectCancel, [49, prog.requestId, {
        mode : "kill"
    }]);
});

test("reply with ERROR(cancel), close() should resolve and progress should error", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    let progress = prog.progress;
    let closing = prog.close();

    // skip CALL and CANCEL
    await serverMonitor.nextK(2);
    server.send([WampType.ERROR, WampType.CALL, prog.requestId, {}, "wamp.error.canceled"]);
    await Promise.all([
        t.notThrows(closing),
        t.throws(progress.toPromise(), MatchError.cancelled())
    ]);
});

test("reply with RESULT(final), close() should resolve and progress should complete", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    let progress = prog.progress.toPromise();
    let closing = prog.close();

    // skip CALL and CANCEL
    await serverMonitor.nextK(2);
    server.send([WampType.RESULT, prog.requestId, {}, [], {a : 1}]);
    await t.notThrows(closing);
    t.deepEqual((await progress).kwargs, {a : 1});
    await Promise.all([
        t.notThrows(closing),

    ]);
});

test("reply with RESULT(progress), close() should not resolve and progress should next", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    let progressMonitor = Rxjs.monitor(prog.progress);
    let closing = prog.close();
    // skip CALL and CANCEL
    await serverMonitor.nextK(2);
    server.send([WampType.RESULT, prog.requestId, {progress : true}, [], {a : 1}]);
    t.deepEqual((await progressMonitor.next()).kwargs, {a : 1});
    await t.throws(Operators.timeout(closing, 10, () => Promise.reject("error")));
});

test("reply with ERROR(non-cancel), close() should reject", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    let progress = prog.progress.toPromise();
    let closing = prog.close();
    server.send([WampType.ERROR, WampType.CALL, prog.requestId, {}, "wamp.error.whatever"]);
    //TODO: Validate error details
    await Promise.all([t.throws(progress), t.notThrows(closing)]);
});

test("cancel is no-op in resolved call", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    let progress = prog.progress.toPromise();
    server.send([WampType.RESULT, prog.requestId, {}, [], {a : 1}]);
    await t.notThrows(progress);
    serverMonitor.clear();
    await t.notThrows(prog.close());
    t.falsy(await serverMonitor.nextWithin(10));
});

test("cancel is no-op in rejected call", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);

    let prog = session.call({
        name: "a"
    });
    let progress = prog.progress.toPromise();

    server.send([WampType.ERROR, WampType.CALL, prog.requestId, {}, "wamp.error.runtime_error", [], {a : 1}]);
    await t.throws(progress);
    serverMonitor.clear();
    await t.notThrows(prog.close());
    t.falsy(await serverMonitor.nextWithin(10));
});

test("2nd call to cancel is no-op, returns the same promise", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    serverMonitor.clear();
    let c1 = prog.close();
    let c2 = prog.close();
    t.is(c1, c2);
    t.truthy(await serverMonitor.next());
    t.falsy(await serverMonitor.nextWithin(10));
});

test.skip("Session closing impact on cancel", async t => {

})