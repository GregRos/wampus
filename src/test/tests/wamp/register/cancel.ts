import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/rxjs";
import {Session} from "../../../../lib/core/session";
import {MyPromise} from "../../../../lib/ext-promise";
import _ = require("lodash");
async function getRegistration({session,server} : {session : Session, server : any}) {
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name : "a"
    });
    let next = await serverMonitor.next();
    server.send([65, next[1], 101]);
    let registered = await registering;
    return registered;
}

test("INTERRUPT sent, then call return() to make sure call is still working", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.registrationId, {}, ["a"], {a : 1}]);
    let invReq = await invocationMonitor.next();
    server.send([49, invReq.requestId, {}]);
    await MyPromise.wait(10);
    await invReq.return({kwargs : {a : 1}});
    t.deepEqual((await serverMonitor.next())[4], {a : 1});
});

test("interruptSignal doesn't fire with no INTERRUPT message, and finishes once the invocation is finished", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.registrationId, {}, ["a"], {a : 1}]);
    let invReq = await invocationMonitor.next();
    let interruptMonitor = Rxjs.monitor(invReq.interruptSignal);
    t.falsy(await interruptMonitor.nextWithin(50));
    await invReq.return({kwargs : {a : 1}});
    t.true(interruptMonitor.isComplete);
});

test("interruptSignal replays past interrupt", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.registrationId, {}, ["a"], {a : 1}]);
    let invReq = await invocationMonitor.next();
    server.send([69, invReq.requestId, {}]);
    await MyPromise.wait(50);
    // TODO: Check cancel token properties
    t.truthy(await invReq.interruptSignal.toPromise());
});

test("interruptSignal waits for future interrupt", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.registrationId, {}, ["a"], {a : 1}]);
    let invReq = await invocationMonitor.next();
    let interrupt = invReq.interruptSignal.toPromise();
    await MyPromise.wait(50);
    server.send([69, invReq.requestId, {}]);
    t.truthy(await interrupt);
});