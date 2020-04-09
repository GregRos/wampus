import test from "ava";
import {dummyTransport} from "../../helpers/dummy-transport";
import {WampProtocolClient} from "~lib/core/routing/wamp-protocol-client";
import {take} from "rxjs/operators";
import {WampArray} from "typed-wamp";

import {WampusNetworkError} from "~lib/core/errors/types";
import {range} from "lodash";
import {timer} from "rxjs";
import {timeoutPromise} from "../../helpers/promises";
import {monitor} from "~test/helpers/monitored-observable";

function createPair() {
    let {server, client} = dummyTransport();
    let messenger = WampProtocolClient.create<WampArray>(client, x => x);
    return {messenger, server};
}

test("define one route and then invoke it exactly", async t => {
    let {messenger, server} = createPair();
    let key = [1];
    let a = monitor(messenger.expect$(key));
    server.send([1, "realm", {a: 1}]);
    t.deepEqual(await a.next(), [1, "realm", {a: 1}]);
});

test("define two routes, and invoke each separately", async t => {
    let {messenger, server} = createPair();
    let key = [2];
    let a = monitor(messenger.expect$(key));
    server.send([3, "hi"]);
    t.falsy(await a.nextWithin(5));
    server.send([2, "hi"]);
    t.deepEqual(await a.next(), [2, "hi"]);
    let b = monitor(messenger.expect$([3]));
    server.send([3, "hi"]);
    t.deepEqual(await b.next(), [3, "hi"]);
});

test("close an observable to a route, check that the route was moved", async t => {
    let {messenger} = createPair();
    let a = messenger.expect$([1]).subscribe();
    await timer(0).toPromise();
    t.is(messenger._router.count(), 1);
    a.unsubscribe();
    t.is(messenger._router.count(), 0);
});

test("the expectNext route should match together with a regular route", async t => {
    let {messenger, server} = createPair();
    let routeSbs = monitor(messenger.expect$([1, 2, 10, 11]));
    let nextRoute = messenger.messages$.pipe(take(1)).toPromise();
    server.send([1, 2, 10, 11]);
    t.is(messenger._router.count(), 2);
    t.truthy(await nextRoute);
    t.truthy(await routeSbs.next());
    t.is(messenger._router.count(), 1);
    server.send([1, 2, 10, 11]);
    t.truthy(await routeSbs.next());
    routeSbs.close();
    t.is(messenger._router.count(), 0);
});

test("expectNext route matches the next error", async t => {
    let {messenger, server} = createPair();
    let a = messenger.messages$.pipe(take(1)).toPromise();
    server.error(new WampusNetworkError("HA!"));
    let err = await t.throwsAsync(a);
    t.assert(err instanceof WampusNetworkError);
});

test("two expectNext routes get called at the same time", async t => {
    let {messenger, server} = createPair();
    let a = messenger.messages$.pipe(take(1)).toPromise();
    let b = messenger.messages$.pipe(take(1)).toPromise();
    server.send([1]);
    server.send([2]);
    await t.deepEqual(await a, [1]);
    await t.deepEqual(await b, [1]);
});

test("invalidate route works with no routes", async t => {
    let {messenger} = createPair();
    messenger.invalidateAllRoutes$(new Error("hi")).subscribe();
    t.pass();
});

test("invalidate route invalidates 5 routes", async t => {
    let {messenger} = createPair();
    t.plan(10);
    let routes = range(0, 5).map(i => messenger.expect$([i]).toPromise());
    messenger.invalidateAllRoutes$(new WampusNetworkError("HA!")).subscribe();
    let prs = await Promise.all(routes.map(p => t.throwsAsync(p)));
    for (let pr of prs) {
        t.assert(pr instanceof WampusNetworkError);
    }
});

test("closing server pushes to onClosed and completes", async t => {
    let {messenger, server} = createPair();
    let clos = messenger.onClosed.toPromise();
    server.close();
    t.truthy(await clos);
});

test("closing does not invalidate non-next routes", async t => {
    let {messenger, server} = createPair();
    let route = messenger.expect$([1]).toPromise();
    server.close();
    t.deepEqual(await timeoutPromise(route, 10, () => [5]), [5]);
});

