import test from "ava";
import {SessionStages} from "~test/helpers/dummy-session";
import {Rxjs} from "~test/helpers/observable-monitor";
import {WampType, WampUri} from "typed-wamp";
import {MatchError} from "~test/helpers/errors";
import {WampusCoreSession} from "~lib/core/session/core-session";
import {isMatch} from "lodash";
import {WampusIllegalOperationError, WampusNetworkError} from "~lib/core/errors/types";
import {timeoutPromise} from "~test/helpers/promises";

test("sends REGISTER", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    // tslint:disable-next-line:no-floating-promises
    session.register({
        name: "a"
    });
    let next = await serverMonitor.next();

    t.true(isMatch(next, {
        0: 64,
        2: {},
        3: "a"
    }));

    t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
});

function testRegisterReceiveError(o: { errorName: string, errMatch(err: Error): boolean, title: string }) {
    test(o.title, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        let serverMonitor = Rxjs.monitor(server.messages);
        let registering = session.register({
            name: "a"
        });
        let next = await serverMonitor.next();
        server.send([WampType.ERROR, WampType.REGISTER, next[1], {}, o.errorName, ["a"], {a: 1}]);
        let err = await t.throwsAsync(registering);
        t.true(o.errMatch(err));
        t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
    });
}

testRegisterReceiveError({
    title: "receive ERROR(invalid uri), throw",
    errMatch: MatchError.illegalOperation("URI"),
    errorName: "wamp.error.invalid_uri"
});

testRegisterReceiveError({
    title: "receive ERROR(procedure already exists), throw",
    errMatch: MatchError.illegalOperation("procedure", "registered"),
    errorName: "wamp.error.procedure_already_exists"
});

testRegisterReceiveError({
    title: "receive ERROR(custom), throw",
    errMatch: MatchError.illegalOperation("ERROR response"),
    errorName: "wamp.error.custom"
});

test("receive REGISTERED, get registration", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name: "a"
    });
    let next = await serverMonitor.next();
    server.send([65, next[1], 101]);
    let registered = await registering;
    t.is(registered.info.registrationId, 101);
    t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
});

async function getRegistration({session, server}: { session: WampusCoreSession, server: any }) {
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name: "a"
    });
    let next = await serverMonitor.next();
    server.send([65, next[1], 101]);
    return await registering;
}

test("after registered, receive INVOCATION, observable fires", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let next = await invocationMonitor.next();
    t.true(isMatch(next, {
        kwargs: {a: 1},
        args: ["a"],
        options: {},
        name: "a"
    }));
});

test("after registered, receive two INVOCATIONS, observable fire each time", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let next = await invocationMonitor.next();
    t.deepEqual(next.kwargs, {a: 1});
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 2}]);
    t.deepEqual((await invocationMonitor.next()).kwargs, {a: 2});
    t.falsy(await invocationMonitor.nextWithin(10));
});

test("after INVOCATION, return sends YIELD(final), no need for reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let next = await invocationMonitor.next();
    await next.return({
        args: ["a"],
        kwargs: {
            a: 1
        }
    });
    let ret = await serverMonitor.next();
    t.true(isMatch(ret, {
        0: 70,
        1: next.invocationId,
        2: {},
        3: ["a"],
        4: {a: 1}
    }));
    t.falsy(await serverMonitor.nextWithin(10));
});

test("after INVOCATION, error sends ERROR, no need for reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let next = await invocationMonitor.next();
    await next.error({
        args: ["a"],
        kwargs: {
            a: 1
        },
        error: "custom.error"
    });
    let ret = await serverMonitor.next();
    t.true(isMatch(ret, {
        0: 8,
        1: WampType.INVOCATION,
        2: next.invocationId,
        3: {},
        4: "custom.error",
        5: ["a"],
        6: {a: 1}
    }));
    t.falsy(await serverMonitor.nextWithin(10));
});

test("after INVOCATION, after error(), cannot call result() or error().", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let next = await invocationMonitor.next();
    await next.error({
        error: "custom.error"
    });
    let err = await t.throwsAsync(next.return({}));
    t.true(err instanceof WampusIllegalOperationError);
    let err2 = await t.throwsAsync(next.error({error: "hi"}));
    t.true(err2 instanceof WampusIllegalOperationError);
});

test("after INVOCATION, after return(final), cannot call result() or error().", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    let serverMonitor = Rxjs.monitor(server.messages);
    server.send([68, 1, registration.info.registrationId, {}, ["a"], {a: 1}]);
    let next = await invocationMonitor.next();
    // tslint:disable-next-line:no-floating-promises
    next.return({});
    let err = await t.throwsAsync(next.return({}));
    t.true(MatchError.illegalOperation("a response or error")(err));
    let err2 = await t.throwsAsync(next.error({error: "hi"}));
    t.true(MatchError.illegalOperation("a response or error")(err2));
});

test("registration.close() sends UNREGISTER, expects reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    t.true(isMatch(unregisterMsg, {
        0: 66,
        2: registration.info.registrationId
    }));
    await t.throwsAsync(timeoutPromise(unregistering, 10));
});


test("while closing, receive UNREGISTERED, closing promise finishes, invocations observable completes, isOpen becomes false", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    server.send([67, unregisterMsg[1]]);
    await t.notThrowsAsync(unregistering);
    t.false(registration.isOpen);
    await t.notThrowsAsync(registration.invocations.toPromise());
});

test("closing 2nd time returns the same promise", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering1 = registration.close();
    let unregistering2 = registration.close();
    t.is(unregistering1, unregistering2);
});

function testUnregisterReceiveError(o: { errorName: string, errMatch(err: Error): boolean, title: string }) {
    test(o.title, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        let registration = await getRegistration({session, server});
        let serverMonitor = Rxjs.monitor(server.messages);
        let unregistering1 = registration.close();
        let unregister = await serverMonitor.next();
        server.send([WampType.ERROR, WampType.UNREGISTER, unregister[1], {}, o.errorName]);
        let err = await t.throwsAsync(unregistering1);
        t.true(o.errMatch(err));
    });
}

testUnregisterReceiveError({
    title: "after UNREGISTER, receive ERROR(no_such_registration), throw",
    errorName: WampUri.Error.NoSuchRegistration,
    errMatch: MatchError.illegalOperation("exist")
});

testUnregisterReceiveError({
    title: "after UNREGISTER, receive ERROR(custom), throw",
    errorName: "error.custom",
    errMatch: MatchError.illegalOperation("error.custom")
});

test("ERROR reply to UNREGISTER throws exception", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering1 = registration.close();
    let unregister = await serverMonitor.next();
    server.send([WampType.ERROR, WampType.UNREGISTER, unregister[1], {}, WampUri.Error.NoSuchRegistration]);
    let err = await t.throwsAsync(unregistering1);
    t.true(err instanceof WampusIllegalOperationError);
});


test("after UNREGISTERED, handle pending invocations", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let invocationMonitor = Rxjs.monitor(registration.invocations);
    server.send([68, 1, registration.info.registrationId, {}]);
    server.send([68, 1, registration.info.registrationId, {}]);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    server.send([67, unregisterMsg[1]]);
    await t.notThrowsAsync(unregistering);
    let invocation1 = await invocationMonitor.next();
    let invocation2 = await invocationMonitor.next();

    await invocation1.return({kwargs: {a: 1}});
    await invocation2.error({error: "hi"});
    let retMsg = await serverMonitor.next();
    t.true(isMatch(retMsg, {
        0: WampType.YIELD,
        4: {a: 1}
    }));
    let errMsg = await serverMonitor.next();
    t.true(isMatch(errMsg, {
        0: WampType.ERROR,
        1: WampType.INVOCATION,
        4: "hi"
    }));
});

test("procedure() on closed session throws", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    server.send([3, {}, "no"]);
    await session.close();
    let serverMonitor = Rxjs.monitor(server.messages);
    let registering = session.register({
        name: "a"
    });
    let err = await t.throwsAsync(registering);
    t.assert(err instanceof WampusNetworkError);
});

test("procedure() on closing session throws", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let serverMonitor = Rxjs.monitor(server.messages);
    let registeringThrows = t.throwsAsync(session.register({
        name: "a"
    }));
    server.send([3, {}, "no"]);
    await session.close();
    let err = await registeringThrows;
    t.true(err instanceof WampusNetworkError);
});

test("after registration, session close causes registration to close", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let serverMonitor = Rxjs.monitor(server.messages);
    let reg = await getRegistration({session, server});
    t.true(reg.isOpen);
    server.send([3, {}, "no"]);
    await session.close();
    t.false(reg.isOpen);
    await t.notThrowsAsync(reg.invocations.toPromise());
    await t.notThrowsAsync(reg.close());
});

test("receive INVOCATION, session closes, return() and error() throw", async t => {
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
    let err = await t.throwsAsync(invocation.return({}));
    t.true(err instanceof WampusNetworkError);
    let err2 = await t.throwsAsync(invocation.error({error: "a"}));
    t.true(err2 instanceof WampusNetworkError);
});

test("while closing registration, session closes instead of UNREGISTER reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let registration = await getRegistration({session, server});
    let serverMonitor = Rxjs.monitor(server.messages);
    let unregistering = registration.close();
    let unregisterMsg = await serverMonitor.next();
    server.send([3, {}, "no"]);
    await session.close();
    await t.notThrowsAsync(unregistering);
    t.false(registration.isOpen);
    await t.notThrowsAsync(registration.invocations.toPromise());
});