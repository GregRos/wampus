import test from "ava";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {WampType, WampUri} from "typed-wamp";
import {MatchError} from "~test/helpers/error-matchers";

import {isMatch} from "lodash";
import {WampusNetworkError} from "~lib/core/errors/types";
import {timer} from "rxjs";
import {timeoutPromise} from "~test/helpers/promises";
import {monitor} from "~test/helpers/rxjs-monitor";

test("sends SUBSCRIBE", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    // tslint:disable-next-line:no-floating-promises
    session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    t.true(isMatch(subscribeMsg, {
        0: 32,
        2: {},
        3: "hi"
    }));
});

test("topic() waits for reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    monitor(server.messages);
    await t.throwsAsync(timeoutPromise(session.topic({name: "x"}), 20));
});

test("topic() waits for SUBSCRIBED, EventSubscription basic tests", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let subscription = await pendingSub;
    t.is(subscription.info.subscriptionId, 101);
    t.true(subscription.isOpen);
    let eventMonitor = monitor(subscription.events);
    t.falsy(await eventMonitor.nextWithin(20));
});

test("topic() on closed session throws", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    server.send([3, {}, "no"]);
    await session.close();
    monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let err = await t.throwsAsync(pendingSub);
    t.assert(err instanceof WampusNetworkError);
});

test("topic() on a closing session throws", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let throwSub = t.throwsAsync(session.topic({name: "hi"}));
    await timer(10).toPromise();
    server.send([3, {}, "no"]);
    await session.close();
    let err = await throwSub;
    t.assert(err instanceof WampusNetworkError);
});

test("after topic(), session closing closes subscription", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let subscription = await pendingSub;
    t.is(subscription.isOpen, true);
    server.send([3, {}, "no"]);
    await session.close();
    t.is(subscription.isOpen, false);
    await t.notThrowsAsync(subscription.events.toPromise());
    await t.notThrowsAsync(subscription.close());
});

test("send EVENT, verify EventArgs properties", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = monitor(sub.events);
    server.send([36, sub.info.subscriptionId, 201, {}, ["a"], {a: 1}]);
    let event = await eventMonitor.next();
    t.true(isMatch(event, {
        kwargs: {a: 1},
        args: ["a"],
        details: {}
    }));
    t.true(!eventMonitor.isComplete);
});

test("send EVENT twice, observable emits two EventArgs", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = monitor(sub.events);
    server.send([36, sub.info.subscriptionId, 201, {}, ["a"], {a: 1}]);
    server.send([36, sub.info.subscriptionId, 201, {}, ["a"], {a: 2}]);
    let event = await eventMonitor.next();
    t.deepEqual(event.kwargs, {a: 1});
    t.deepEqual((await eventMonitor.next()).kwargs, {a: 2});
});

function testSubscribeReceiveError(o: { errorName: string, errMatch(err: Error): boolean, title: string }) {
    test(o.title, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        let serverMonitor = monitor(server.messages);
        let subbing = session.topic({
            name: "a"
        });
        let next = await serverMonitor.next();
        server.send([WampType.ERROR, WampType.SUBSCRIBE, next[1], {}, o.errorName, ["a"], {a: 1}]);
        let err = await t.throwsAsync(subbing);
        t.true(o.errMatch(err));
        t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
    });
}

testSubscribeReceiveError({
    errorName: "wamp.error.invalid_uri",
    // TODO: Better error verification
    errMatch: MatchError.illegalOperation("URI"),
    title: "send SUBSCRIBE, receive ERROR(invalid_uri), throw "
});

testSubscribeReceiveError({
    errorName: "wamp.error.blah",
    // TODO: Better error verification
    errMatch: MatchError.illegalOperation("ERROR"),
    title: "send SUBSCRIBE, receive ERROR(custom), throw "
});

test("close() sends UNSUBSCRIBE, expects reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    monitor(sub.events);
    let unsubbing = sub.close();
    let unsubMsg = await serverMonitor.next();
    t.true(isMatch(unsubMsg, {
        0: 34,
        2: sub.info.subscriptionId
    }));
    await t.throwsAsync(timeoutPromise(unsubbing, 20));
});

test("receives UNSUBSCRIBED, events complete", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = monitor(sub.events);
    let unsubbing = sub.close();
    let unsubMsg = await serverMonitor.next();
    server.send([35, unsubMsg[1]]);
    await t.notThrowsAsync(unsubbing);
    t.true(eventMonitor.isComplete);
    await t.notThrowsAsync(sub.events.toPromise());
    t.false(sub.isOpen);
});

test("close() subscription, session closes instead of UNSUBSCRIBE, subscription still closes", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = monitor(sub.events);
    let unsubbing = sub.close();
    await serverMonitor.next();
    server.send([3, {}, "no"]);
    await session.close();
    await t.notThrowsAsync(unsubbing);
    t.true(eventMonitor.isComplete);
    await t.notThrowsAsync(sub.events.toPromise());
    t.false(sub.isOpen);
});

function testUnsubscribeReceiveError(o: { errorName: string, errMatch(err: Error): boolean, title: string }) {
    test(o.title, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        let serverMonitor = monitor(server.messages);
        let pendingSub = session.topic({name: "hi"});
        let subscribeMsg = await serverMonitor.next();
        server.send([33, subscribeMsg[1], 101]);
        let sub = await pendingSub;
        monitor(sub.events);
        let unsubbing1 = sub.close();
        let unsubMsg = await serverMonitor.next();
        server.send([WampType.ERROR, WampType.UNSUBSCRIBE, unsubMsg[1], {}, o.errorName]);
        let err = await t.throwsAsync(unsubbing1);
        t.true(o.errMatch(err));
    });
}

testUnsubscribeReceiveError({
    title: "after UNREGISTER, receive ERROR(no_such_subscription), throw",
    errMatch: MatchError.illegalOperation("subscription"),
    errorName: WampUri.Error.NoSuchSubscription
});

testUnsubscribeReceiveError({
    title: "after UNREGISTER, receive ERROR(custom), throw",
    errMatch: MatchError.illegalOperation("error.custom"),
    errorName: "error.custom"
});

test("calling close() a 2nd time returns the same promise", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let pendingSub = session.topic({name: "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    monitor(sub.events);
    let unsubbing1 = sub.close();
    let unsubbing2 = sub.close();
    t.is(unsubbing1, unsubbing2);

});
