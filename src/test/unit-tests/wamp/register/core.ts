import test from "ava";
import {SessionStages} from "../../../helpers/dummy-session";
import {Rxjs} from "../../../helpers/observable-monitor";
import _ = require("lodash");
import {WampType} from "../../../../lib/core/protocol/message.type";
import {MatchError} from "../../../helpers/errors";
import {WampusCoreSession} from "../../../../lib/core/session/core-session";
import {Operators} from "promise-stuff";
import {WampUri} from "../../../../lib/core/protocol/uris";

test("sends REGISTER", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    session.register({
        name : "a"
    });
    let next = await serverMonitor.next();

    t.true(_.isMatch(next, {
        0 : 64,
        2 : {},
        3 : "a"
    }));

    t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
});

function testRegisterReceiveError(o : {errorName : string, errMatch : (err : Error) => boolean, title : string}) {
    test(o.title, async t => {
        let {session,server} = await SessionStages.handshaken("a");
        let serverMonitor = Rxjs.monitor(server.messages);
        let registering = session.register({
            name : "a"
        });
        let next = await serverMonitor.next();
        server.send([WampType.ERROR, WampType.REGISTER, next[1], {}, o.errorName, ["a"], {a : 1}]);
        await t.throws(registering, o.errMatch);
        t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
    });
}

testRegisterReceiveError({
    title : "receive ERROR(invalid uri), throw",
    errMatch : MatchError.illegalOperation("URI"),
    errorName : "wamp.error.invalid_uri"
});

testRegisterReceiveError({
    title : "receive ERROR(procedure already exists), throw",
    errMatch : MatchError.illegalOperation("procedure", "registered"),
    errorName : "wamp.error.procedure_already_exists"
});

testRegisterReceiveError({
    title : "receive ERROR(custom), throw",
    errMatch : MatchError.illegalOperation("ERROR response"),
    errorName : "wamp.error.custom"
});

test("receive REGISTERED, get registration", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name : "a"
    });
    let next = await serverMonitor.next();
    server.send([65, next[1], 101]);
    let registered = await registering;
    t.is(registered.info.registrationId, 101);
    t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
});

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

test("after registered, receive INVOCATION, observable fires", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    t.true(_.isMatch(next, {
        kwargs : {a : 1},
        args : ["a"],
        options : {},
        name : "a",
    }));
});

test("after registered, receive two INVOCATIONS, observable fire each time", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    t.deepEqual(next.kwargs, {a : 1});
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 2}]);
    t.deepEqual((await invocationMonitor.next()).kwargs, {a : 2});
    t.falsy(await invocationMonitor.nextWithin(10));
});

test("after INVOCATION, return sends YIELD(final), no need for reply", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    await next.return({
        args : ["a"],
        kwargs : {
            a : 1
        }
    });
    let ret = await serverMonitor.next();
    t.true(_.isMatch(ret, {
        0 : 70,
        1 : next.invocationId,
        2 : {},
        3 : ["a"],
        4 : {a : 1}
    }));
    t.falsy(await serverMonitor.nextWithin(10));
});

test("after INVOCATION, error sends ERROR, no need for reply", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    await next.error({
        args : ["a"],
        kwargs : {
            a : 1
        },
        error : "custom.error"
    });
    let ret = await serverMonitor.next();
    t.true(_.isMatch(ret, {
        0 : 8,
        1 : WampType.INVOCATION,
        2 : next.invocationId,
        3 : {},
        4 : "custom.error",
        5 : ["a"],
        6 : {a : 1}
    }));
    t.falsy(await serverMonitor.nextWithin(10));
});

test("after INVOCATION, after error(), cannot call result() or error().", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    next.error({
        error : "custom.error"
    });
    await t.throws(next.return({}), MatchError.illegalOperation("ried to yield"));
    await t.throws(next.error({error: "hi"}), MatchError.illegalOperation("ried to yield"))
});

test("after INVOCATION, after return(final), cannot call result() or error().", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a : 1}]);
    let next = await invocationMonitor.next();
    next.return({

    });
    await t.throws(next.return({}), MatchError.illegalOperation("a response or error"));
    await t.throws(next.error({error : "hi"}), MatchError.illegalOperation("a response or error"))
});

test("registration.close() sends UNREGISTER, expects reply", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    t.true(_.isMatch(unregisterMsg, {
        0 : 66,
        2 : registration.info.registrationId
    }));
    await t.throws(Operators.timeout(unregistering, 10))
});



test("while closing, receive UNREGISTERED, closing promise finishes, invocations observable completes, isOpen becomes false", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    server.send([67, unregisterMsg[1]]);
    await t.notThrows(unregistering);
    t.false(registration.isOpen);
    await t.notThrows(registration.invocations.toPromise());
});

test("closing 2nd time returns the same promise", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering1 = registration.close();
    let unregistering2 = registration.close();
    t.is(unregistering1, unregistering2);
});

function testUnregisterReceiveError(o : {errorName : string, errMatch : (err : Error) => boolean, title : string}) {
    test(o.title, async t => {
        let {session,server} = await SessionStages.handshaken("a");
        let registration = await getRegistration({session,server});
        let serverMonitor = Rxjs.monitor(server.messages);
        let unregistering1 = registration.close();
        let unregister = await serverMonitor.next();
        server.send([WampType.ERROR, WampType.UNREGISTER, unregister[1], {}, o.errorName]);
        await t.throws(unregistering1, o.errMatch);
    });
}

testUnregisterReceiveError({
    title : "after UNREGISTER, receive ERROR(no_such_registration), throw",
    errorName : WampUri.Error.NoSuchRegistration,
    errMatch : MatchError.illegalOperation("exist")
});

testUnregisterReceiveError({
    title : "after UNREGISTER, receive ERROR(custom), throw",
    errorName : "error.custom",
    errMatch : MatchError.illegalOperation("error.custom")
});

test("ERROR reply to UNREGISTER throws exception", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering1 = registration.close();
    let unregister = await serverMonitor.next();
    server.send([WampType.ERROR, WampType.UNREGISTER, unregister[1], {}, WampUri.Error.NoSuchRegistration]);
    await t.throws(unregistering1, MatchError.illegalOperation("procedure", "exist"));
});


test("after UNREGISTERED, handle pending invocations", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    server.send([68, 1, registration.info.registrationId, {}]);
    server.send([68, 1, registration.info.registrationId, {}]);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    server.send([67, unregisterMsg[1]]);
    await t.notThrows(unregistering);
    let invocation1 = await invocationMonitor.next();
    let invocation2 = await invocationMonitor.next();

    await invocation1.return({kwargs : {a : 1}});
    await invocation2.error({error : "hi"});
    let retMsg = await serverMonitor.next();
    t.true(_.isMatch(retMsg, {
        0 : WampType.YIELD,
        4 : {a : 1}
    }));
    let errMsg = await serverMonitor.next();
    t.true(_.isMatch(errMsg, {
        0 : WampType.ERROR,
        1 : WampType.INVOCATION,
        4 : "hi"
    }));
});

test("register() on closed session throws", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    server.send([3, {}, "no"]);
    await session.close();
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name : "a"
    });
    await t.throws(registering, MatchError.network("register", "clos"));
});

test("register() on closing session throws", async t => {
    let {session,server} = await SessionStages.handshaken("a");

    let serverMonitor = Rxjs.monitor(server.messages);
    let registeringThrows =  t.throws(session.register({
        name : "a"
    }), MatchError.network("register", "clos"));
    server.send([3, {}, "no"]);
    await session.close();
    await registeringThrows;
});

test("after registration, session close causes registration to close", async t => {
    let {session,server} = await SessionStages.handshaken("a");

    let serverMonitor = Rxjs.monitor(server.messages);
    let reg = await getRegistration({session,server});
    t.true(reg.isOpen);
    server.send([3, {}, "no"]);
    await session.close();
    t.false(reg.isOpen);
    await t.notThrows(reg.invocations.toPromise());
    await t.notThrows(reg.close());
});

test("receive INVOCATION, session closes, return() and error() throw", async t => {
    let {session,server} = await SessionStages.handshaken("a");

    let serverMonitor = Rxjs.monitor(server.messages);
    let reg = await getRegistration({session,server});
    t.true(reg.isOpen);
    let invocationMonitor = Rxjs.monitor(reg.invocations);
    server.send([WampType.INVOCATION, 101, reg.info.registrationId, {}, [], {a : 1}]);
    let invocation = await invocationMonitor.next();
    t.is(invocation.invocationId, 101);
    t.deepEqual(invocation.kwargs, {a : 1});
    server.send([3, {}, "no"]);
    await session.close();
    await t.throws(invocation.return({}), MatchError.network("yield", "response", "clos"));
    await t.throws(invocation.error({error : "a"}), MatchError.network("error", "response", "clos"));
});

test("while closing registration, session closes instead of UNREGISTER reply", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session,server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    server.send([3, {}, "no"]);
    await session.close();
    await t.notThrows(unregistering);
    t.false(registration.isOpen);
    await t.notThrows(registration.invocations.toPromise());
});