import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/rxjs";
import _ = require("lodash");
import {WampType} from "../../../../lib/protocol/message.type";
import {MatchError} from "../../../helpers/errors";
import {Session} from "../../../../lib/core/session";
import {Operators} from "promise-stuff";
import {take} from "rxjs/operators";

test("sends SUBSCRIBE", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    session.event({name : "hi"});
    let subscribeMsg = await serverMonitor.next();
    t.true(_.isMatch(subscribeMsg, {
        0 : 32,
        2 : {},
        3 : "hi"
    }));
});

test("event() waits for reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    await t.throws(Operators.timeout(session.event({name : "x"}), 20));
});

test("event() waits for SUBSCRIBED, EventSubscription basic tests", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let pendingSub = session.event({name : "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let subscription = await pendingSub;
    t.is(subscription.subscriptionId, 101);
    t.true(subscription.isOpen);
    let eventMonitor = Rxjs.monitor(subscription.events);
    t.falsy(await eventMonitor.nextWithin(20));
});



test("send EVENT, verify EventArgs properties", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let pendingSub = session.event({name : "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = Rxjs.monitor(sub.events);
    server.send([36, sub.subscriptionId, 201, {}, ["a"], {a : 1}]);
    let event = await eventMonitor.next();
    t.true(_.isMatch(event, {
        kwargs : {a : 1},
        args : ["a"],
        details : {},
        name : "hi"
    }));
    t.true(!eventMonitor.isComplete);
});

test("send EVENT twice, observable emits two EventArgs", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let pendingSub = session.event({name : "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = Rxjs.monitor(sub.events);
    server.send([36, sub.subscriptionId, 201, {}, ["a"], {a : 1}]);
    server.send([36, sub.subscriptionId, 201, {}, ["a"], {a : 2}]);
    let event = await eventMonitor.next();
    t.deepEqual(event.kwargs, { a : 1});
    t.deepEqual((await eventMonitor.next()).kwargs, {a : 2});
});

function testSubscribeReceiveError(o : {errorName : string, errMatch : (err : Error) => boolean, title : string}) {
    test(o.title, async t => {
        let {session,server} = await SessionStages.handshaken("a");
        let serverMonitor = Rxjs.monitor(server.messages);
        let subbing = session.event({
            name : "a"
        });
        let next = await serverMonitor.next();
        server.send([WampType.ERROR, WampType.SUBSCRIBE, next[1], {}, o.errorName, ["a"], {a : 1}]);
        await t.throws(subbing, o.errMatch);
        t.falsy(await serverMonitor.nextWithin(10), "sent extra message");
    });
}

testSubscribeReceiveError({
    errorName : "wamp.error.invalid_uri",
    //TODO: Better error verification
    errMatch : MatchError.illegalOperation("URI"),
    title : "send SUBSCRIBE, receive ERROR(invalid_uri), throw "
});

testSubscribeReceiveError({
    errorName : "wamp.error.blah",
    //TODO: Better error verification
    errMatch : MatchError.illegalOperation("ERROR"),
    title : "send SUBSCRIBE, receive ERROR(custom), throw "
});

test("close() sends UNSUBSCRIBE, expects reply", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let pendingSub = session.event({name : "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = Rxjs.monitor(sub.events);
    let unsubbing = sub.close();
    let unsubMsg = await serverMonitor.next();
    t.true(_.isMatch(unsubMsg, {
        0 : 34,
        2 : sub.subscriptionId
    }));
    await t.throws(Operators.timeout(unsubbing, 20));
});

test("receives UNSUBSCRIBED, events complete", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let pendingSub = session.event({name : "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = Rxjs.monitor(sub.events);
    let unsubbing = sub.close();
    let unsubMsg = await serverMonitor.next();
    server.send([35,unsubMsg[1]]);
    await t.notThrows(unsubbing);
    t.true(eventMonitor.isComplete);
    await t.notThrows(sub.events.toPromise());
    t.false(sub.isOpen);
});

test("calling close() a 2nd time returns the same promise", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let pendingSub = session.event({name : "hi"});
    let subscribeMsg = await serverMonitor.next();
    server.send([33, subscribeMsg[1], 101]);
    let sub = await pendingSub;
    let eventMonitor = Rxjs.monitor(sub.events);
    let unsubbing1 = sub.close();
    let unsubbing2 = sub.close();
    t.is(unsubbing1, unsubbing2);
});