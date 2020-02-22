import test from "ava";
import {SessionStages} from "~test/helpers/dummy-session";
import {Rxjs} from "~test/helpers/observable-monitor";
import {WampusCoreSession} from "~lib/core/session/core-session";

import {WampType} from "typed-wamp";
import {timer} from "rxjs";

async function getRegistration({session, server}: { session: WampusCoreSession, server: any }) {
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name: "a"
    });
    let next = await serverMonitor.next();
    server.send([65, next[1], 101]);
    return await registering;
}

test("INTERRUPT sent, then call return() to make sure call is still working", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let invReq = await invocationMonitor.next();
    server.send([69, invReq.invocationId, {}]);
    await timer(10).toPromise();
    await invReq.return({kwargs: {a: 1}});
    t.deepEqual((await serverMonitor.next())[4], {a: 1});
});

test("interruptSignal doesn't fire with no INTERRUPT message, and finishes once the invocation is finished", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let invReq = await invocationMonitor.next();
    let interruptMonitor = Rxjs.monitor(invReq.cancellation);
    t.falsy(await interruptMonitor.nextWithin(50));
    await invReq.return({kwargs: {a: 1}});
    t.true(interruptMonitor.isComplete);
});

test("interruptSignal replays past interrupt", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let invReq = await invocationMonitor.next();
    server.send([69, invReq.invocationId, {}]);
    await timer(50).toPromise();
    // TODO: Check cancel token properties
    t.truthy(await invReq.cancellation.toPromise());
});

test("interruptSignal waits for future interrupt", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let invReq = await invocationMonitor.next();
    let interrupt = invReq.cancellation.toPromise();
    await timer(50).toPromise();
    server.send([69, invReq.invocationId, {}]);
    t.truthy(await interrupt);
});

test("receive INVOCATION, session closes, interruptSignal completes", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let serverMonitor = Rxjs.monitor(server.messages);
    let reg = await getRegistration({session, server});
    t.true(reg.isOpen);
    let invocationMonitor = Rxjs.monitor(reg.invocations);
    server.send([WampType.INVOCATION, 101, reg.info.registrationId, {}, [], {a: 1}]);
    let invocation = await invocationMonitor.next();
    t.is(invocation.invocationId, 101);
    t.deepEqual(invocation.kwargs, {a: 1});
    server.send([3, {}, "no"]);
    await session.close();
    await t.notThrowsAsync(invocation.cancellation.toPromise());
});