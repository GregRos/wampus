import test, {GenericTestContext} from "ava";
import {dummyTransport} from "../../helpers/dummy-transport";
import {WampMessenger} from "../../../lib/core/messaging/wamp-messenger";
import {Observer, Subject} from "rxjs";
import {MessageRouter} from "../../../lib/core/routing/message-router";
import _ = require("lodash");

function getRoute<T>(key : any[], tag ?: string) {
    return Object.assign(new Subject(), {
        keys : key,
        tag
    });
}


function setEqual(a : any[], b : any[]) {
    return _.isEqual(new Set(a), new Set(b));
}

test("should fulfill empty invariants", t => {
    let router = new MessageRouter();
    t.is(router.count(), 0);
    t.deepEqual(router.matchAll(), []);
    t.deepEqual(router.match([]), []);
});

test("remove non-existent route is okay", t => {
    let router = new MessageRouter();
    router.removeRoute({
        keys : []
    });
    t.is(router.count(), 0);
});

test("match two identical routes + removals", t => {
    let router = new MessageRouter();
    let route1 = getRoute([1, 2, 3], "a");
    let route2 = getRoute([1, 2, 3], "b");
    router.insertRoute(route1);
    router.insertRoute(route2);
    t.true(setEqual(router.match([1, 2, 3]), [route1, route2]));
    router.removeRoute(route2);
    t.true(setEqual(router.match([1, 2, 3]), [route1]));
});

test("match single route in various ways", t => {
    let router = new MessageRouter();
    let route = getRoute([1, 2, 3]);
    router.insertRoute(route);
    t.is(router.count(), 1);
    t.deepEqual(router.match([1, 2, 3]), [route], "failed exact match");
    t.deepEqual(router.match([1, 2, 3, 4]), [route], "failed broad match");
    t.deepEqual(router.match([1, 2]), [], "failed narrow match");
    t.deepEqual(router.matchAll(), [route]);
    t.deepEqual(router.prefixMatch([1]), [route]);
});

test("match two routes, subsequence case", t => {
    let router = new MessageRouter();
    let route1 = getRoute([1, 2, 3]);
    let route2 = getRoute([1, 2, 3, 4]);
    router.insertRoute(route1);
    router.insertRoute(route2);
    t.is(router.count(), 2);
    t.deepEqual(router.match([1]), [], "failed broad match");
    t.true(setEqual(router.match([1, 2, 3, 4]), [route1, route2]));
    t.true(setEqual(router.match([1, 2, 3]), [route1]));
    t.true(setEqual(router.prefixMatch([1, 2, 3]), [route1, route2]));
    t.true(setEqual(router.prefixMatch([1, 2]), [route1, route2]));
});

test("match two routes, shared prefix case", t => {
    let router = new MessageRouter();
    let route1 = getRoute([1, 2, 4]);
    let route2 = getRoute([1, 2, 3, 4]);
    router.insertRoute(route1);
    router.insertRoute(route2);
    t.is(router.count(), 2);
    t.deepEqual(router.match([1]), [], "failed broad match");
    t.true(setEqual(router.match([1, 2, 3]), []));
    t.true(setEqual(router.match([1, 2, 4]), [route1]));
    t.true(setEqual(router.match([1, 2, 3, 4]), [route2]));

    t.true(setEqual(router.prefixMatch([1, 2]), [route1, route2]));
    t.true(setEqual(router.prefixMatch([1, 2, 3]), [route2]));
});

test("match two isolated routes", t => {
    let router = new MessageRouter();
    let route1 = getRoute([1, 2, 3]);
    let route2 = getRoute([5, 6, 1]);
    router.insertRoute(route1);
    router.insertRoute(route2);
    t.is(router.count(), 2);
    t.true(setEqual(router.match([1, 2]), []));
    t.true(setEqual(router.match([1, 2, 3]), [route1]));
    t.true(setEqual(router.match([5, 6, 1]), [route2]));
});

test("remove route", t => {
    let router = new MessageRouter();
    let route1 = getRoute([1, 2, 4]);
    let route2 = getRoute([1, 2, 3]);
    router.insertRoute(route1);
    router.removeRoute(route2);
    t.is(router.count(), 1);
    router.insertRoute(route2);
    t.deepEqual(router.match([1, 2, 4]), [route1]);
    router.removeRoute(route2);
    t.deepEqual(router.match([1, 2, 4]), [route1]);
    t.deepEqual(router.match([1, 2, 3]), []);
    router.insertRoute(route1);
    router.removeRoute(route2);
    t.deepEqual(router.match([1, 2, 4]), [route1, route1]);
});

