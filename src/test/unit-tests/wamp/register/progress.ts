import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/observable-monitor";
import _ = require("lodash");
import {WampType} from "../../../../lib/core/protocol/message.type";
import {MatchError} from "../../../helpers/errors";
import {WampusCoreSession} from "../../../../lib/core/session/core-session";
import {Operators} from "promise-stuff";
import {Routes} from "../../../../lib/core/protocol/routes";
import invocation = Routes.invocation;



async function getRegistration({session,server} : {session : WampusCoreSession, server : any}) {
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name : "a"
    });
    let next = await serverMonitor.next();
    server.send([65, next[1], 101]);
    let registered = await registering;
    return registered;
}

test("progress() sends YIELD(progress)", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {receive_progress : true}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    await next.progress({
        kwargs : {a : 1}
    });
    let msgYield = await serverMonitor.next();
    t.true(_.isMatch(msgYield, {
        0 : 70,
        1 : next.invocationId,
        2 : {
            progress : true
        },
        4 : {a : 1}
    }));
});

test("after progress(), call return(), invocation finished", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {receive_progress : true}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    await next.progress({
        kwargs : {a : 1}
    });
    await serverMonitor.next();
    await next.return({kwargs : { a : 2}});
    let finalMsg = await serverMonitor.next();
    t.deepEqual(finalMsg[4], {a : 2});
    t.true(next.isHandled);
});

test("after return(), progress() errors", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {receive_progress : true}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    await next.return({kwargs : {a : 1}});
    await t.throws(next.progress({kwargs : {a : 2}}));
});

test("progress() errors if no progress has been requested", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    await t.throws(next.progress({kwargs : {a : 2}}), MatchError.illegalOperation("progress"));
});