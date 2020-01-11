import test from "ava";
import {SessionStages} from "../../../helpers/dummy-session";
import {MatchError} from "../../../helpers/errors";
import {WampType} from "typed-wamp";
import {MyPromise} from "../../../../lib/utils/ext-promise";
import {Rxjs} from "../../../helpers/observable-monitor";
import {Operators} from "promise-stuff";
import {WampusIllegalOperationError, WampusInvocationCanceledError} from "../../../../lib/core/errors/types";


async function cancelSession() {
    return SessionStages.handshaken("a", {
            dealer: {
                call_canceling: true
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
    let err = await t.throwsAsync(prog.close());
    t.assert(err instanceof WampusIllegalOperationError);
    let pending = prog.progress.toPromise();
    server.send([WampType.RESULT, prog.info.callId, {}, [], {a: 1}]);
    t.deepEqual((await pending).kwargs, {a: 1});
});

test("should send CANCEL", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    // don't await close(), because it will expect a RESULT or ERROR from server.
    // tslint:disable-next-line:no-floating-promises
    prog.close();
    let a = await serverMonitor.next();
    let expectCancel = await serverMonitor.next();
    t.deepEqual(expectCancel, [49, prog.info.callId, {
        mode: "kill"
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
    server.send([WampType.ERROR, WampType.CALL, prog.info.callId, {}, "wamp.error.canceled"]);
    let [a, b] = await Promise.all([
        t.notThrowsAsync(closing),
        t.throwsAsync(progress.toPromise())
    ]);
    t.assert(b instanceof WampusInvocationCanceledError);

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
    server.send([WampType.RESULT, prog.info.callId, {}, [], {a: 1}]);
    await t.notThrowsAsync(closing);
    t.deepEqual((await progress).kwargs, {a: 1});
    await Promise.all([
        t.notThrowsAsync(closing)

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
    server.send([WampType.RESULT, prog.info.callId, {progress: true}, [], {a: 1}]);
    t.deepEqual((await progressMonitor.next()).kwargs, {a: 1});
    await t.throwsAsync(Operators.timeout(closing, 10, () => Promise.reject(new Error())));
});

test("reply with ERROR(non-cancel), close() should reject", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    let progress = prog.progress.toPromise();
    let closing = prog.close();
    await serverMonitor.next();
    server.send([WampType.ERROR, WampType.CALL, prog.info.callId, {}, "wamp.error.whatever"]);
    // TODO: Validate error details
    await Promise.all([t.throwsAsync(progress), t.notThrowsAsync(closing)]);
});

test("cancel is no-op in resolved call", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    await serverMonitor.next();
    let progress = prog.progress.toPromise();
    server.send([WampType.RESULT, prog.info.callId, {}, [], {a: 1}]);
    await t.notThrowsAsync(progress);
    await MyPromise.wait(10);
    await t.notThrowsAsync(prog.close());
    t.falsy(await serverMonitor.nextWithin(10));
});

test("cancel is no-op in rejected call", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);

    let prog = session.call({
        name: "a"
    });
    await serverMonitor.next();
    let progress = prog.progress.toPromise();

    server.send([WampType.ERROR, WampType.CALL, prog.info.callId, {}, "wamp.error.runtime_error", [], {a: 1}]);
    await t.throwsAsync(progress);
    await t.notThrowsAsync(prog.close());
    t.falsy(await serverMonitor.nextWithin(10));
});

test("2nd call to cancel is no-op, returns the same promise", async t => {
    let {session, server} = await cancelSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let prog = session.call({
        name: "a"
    });
    await serverMonitor.next();
    let c1 = prog.close();
    let c2 = prog.close();
    t.is(c1, c2);
    t.truthy(await serverMonitor.next());
    t.falsy(await serverMonitor.nextWithin(10));
});

test("try to cancel call on a closed session should be a no-op", async t => {
    let {server, session} = await SessionStages.handshaken("a", {
        dealer: {
            call_canceling: true
        }
    });
    let sbs = Rxjs.monitor(server.messages);

    let cp1 = session.call({
        name: "a"
    });
    server.send([3, {}, "no"]);
    await session.close();
    await t.notThrowsAsync(cp1.close());
});

test("close session while cancelling should be a no-op", async t => {
    let {server, session} = await SessionStages.handshaken("a", {
        dealer: {
            call_canceling: true
        }
    });
    let sbs = Rxjs.monitor(server.messages);

    let cp1 = session.call({
        name: "a"
    });
    let a = cp1.close();
    await MyPromise.wait(100);
    server.send([3, {}, "no"]);
    await session.close();
    await t.notThrowsAsync(cp1.close());
});
