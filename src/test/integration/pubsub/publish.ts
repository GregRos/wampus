import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {take, toArray} from "rxjs/operators";
import {merge} from "rxjs";
import _ = require("lodash");

test.beforeEach(async t => {
    t.context = {
        session: await RealSessions.session()
    };
});
test.afterEach(async t => {
    await t.context.session.close();
});

test("verify event ticket", async t => {
    let session = t.context.session as WampusSession;

    let ticket = await session.topic({
        name: "wampus.example"
    });

    let justOneEvent = ticket.events.pipe(take(1)).toPromise();

    await session.publish({
        name: ticket.info.name,
        options: {
            exclude_me: false
        },
        args: [1, 2],
        kwargs: {
            a: 1
        }
    });

    let oneEvent = await justOneEvent;

    t.is(oneEvent.source, ticket);
    t.true(_.isMatch(oneEvent, {
        args: [1, 2],
        kwargs: {
            a: 1
        }
    }));
});

test("verify multiple events via topic", async t => {
    let session = t.context.session as WampusSession;

    let ticket = await session.topic({
        name: "wampus.example"
    });

    let threeEvents = ticket.events.pipe(take(3), toArray()).toPromise();

    for (let x of _.range(0, 10)) {
        await session.publish({
            name: ticket.info.name,
            options: {
                exclude_me: false
            },
            args: [x]
        });
    }

    let eventValues = (await threeEvents).map(x => x.args[0]);

    t.deepEqual(eventValues, [0, 1, 2]);
});

test("event data via event", async t => {
    let session = t.context.session as WampusSession;

    let ticket = await session.topic({
        name: "wampus.example"
    });

    let eventData = [];

    let tenthEvent = ticket.events.pipe(take(10)).toPromise();

    function onEvent(e) {
        eventData.push(e);
        if (eventData.length === 3) ticket.off("event", onEvent);
    }

    ticket.on("event", onEvent);

    for (let x of _.range(0, 10)) {
        await session.publish({
            name: ticket.info.name,
            options: {
                exclude_me: false
            },
            args: [x]
        });
    }

    await tenthEvent;

    let eventValues = eventData.map(x => x.args[0]);

    t.deepEqual(eventValues, [0, 1, 2]);
});


test("publish and receive in multi-topic ticket", async t => {
    let session = t.context.session as WampusSession;
    let topics = ["a.b", "c", "d"];
    let ticket = await session.topics(["a.b", "c", "d"]);
    let keys = topics;
    let oneEach = keys.map(x => ticket.topic[x].pipe(take(1)).toPromise());

    await Promise.all(keys.map(key => {
        return session.publish({
            name: key,
            options: {
                exclude_me: false
            },
            args: [key]
        });
    }));

    for (let r of oneEach) {
        let x = await r;
        t.deepEqual(x.args, [x.source.info.name]);
    }
});

test("publish and receive in multi-topic ticket via event", async t => {
    let session = t.context.session as WampusSession;
    let topics = ["a.b", "c", "d"];
    let ticket = await session.topics(["a.b", "c", "d"]);
    let keys = topics;
    let results = [];

    for (let key of keys) {
        ticket.on(key as any, x => {
            results.push([key, x.args]);
        });
    }
    await Promise.all(keys.map(key => {
        return session.publish({
            name: key,
            options: {
                exclude_me: false
            },
            args: [key]
        });
    }));


    await merge(..._.map(ticket.topic, x => x)).pipe(take(3)).toPromise();

    t.deepEqual(new Set(results), new Set(keys.map(x => [x, [x]])));
});
