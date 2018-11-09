import test from "ava";
import {SessionStages} from "../../../helpers/dummy-session";
import {Rxjs} from "../../../helpers/observable-monitor";
import {WampType} from "../../../../lib/core/protocol/message.type";
import {WampusCoreSession} from "../../../../lib/core/session/core-session";
import {MyPromise} from "../../../../lib/utils/ext-promise";

async function getProgressSession() {
    return await SessionStages.handshaken("a", {
        dealer : {
            progressive_call_results : true
        }
    });
}

async function makeProgressiveCall(session : WampusCoreSession, name : string) {
    return session.call({
        name: name,
        options : {
            receive_progress : true
        }
    });
}

test("make call, receive RESULT(progress) message, call doesn't finish", async t => {
    let {server, session} = await getProgressSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let cp1 = await makeProgressiveCall(session, "a");
    let progressMonitor = Rxjs.monitor(cp1.progress);
    await serverMonitor.nextK(1);
    server.send([WampType.RESULT, cp1.info.callId, {progress : true}, [], {a : 1}]);
    let first = await progressMonitor.next();
    t.deepEqual(first.kwargs, {a : 1});
    t.false(progressMonitor.isComplete);
    t.falsy(await progressMonitor.nextWithin(50));
});

test("make call, receive several RESULT(progress) messages, call doesn't finish", async t => {
    let {server, session} = await getProgressSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let cp1 = await makeProgressiveCall(session, "a");
    let progressMonitor = Rxjs.monitor(cp1.progress);
    await serverMonitor.nextK(1);
    server.send([WampType.RESULT, cp1.info.callId, {progress : true}, [], {a : 1}]);
    await MyPromise.wait(1000);
    let item1 = await progressMonitor.next();
    server.send([WampType.RESULT, cp1.info.callId, {progress : true}, [], {a : 2}]);
    let item2 = await progressMonitor.next();
    server.send([WampType.RESULT, cp1.info.callId, {progress : true}, [], {a : 3}]);
    let item3 = await progressMonitor.next();
    t.deepEqual([item1, item2, item3].map(x => x.kwargs), [{a : 1}, {a : 2}, {a : 3}]);
    t.false(progressMonitor.isComplete);
    t.falsy(await progressMonitor.nextWithin(50));
});

test("make call, receive RESULT(progress) message, and then RESULT(final), call finishes", async t => {
    let {server, session} = await getProgressSession();
    let serverMonitor = Rxjs.monitor(server.messages);
    let cp1 = await makeProgressiveCall(session, "a");
    let progressMonitor = Rxjs.monitor(cp1.progress);
    await serverMonitor.nextK(1);
    server.send([WampType.RESULT, cp1.info.callId, {progress : true}, [], {a : 1}]);
    let first = await progressMonitor.next();
    t.deepEqual(first.kwargs, {a : 1});
    server.send([WampType.RESULT, cp1.info.callId, {}, [], {a : 2}]);
    let last = await progressMonitor.next();
    t.deepEqual(last.kwargs, {a : 2});
    t.true(progressMonitor.isComplete);
});