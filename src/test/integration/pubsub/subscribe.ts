import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib/index";
import {MatchingPolicy, WampSubscribeOptions} from "../../../lib/core/protocol/options";
import _ = require("lodash");

test.beforeEach(async t => {
    t.context = {
        session: await RealSessions.session()
    };
});
test.afterEach(async t => {
    await t.context.session.close();
});

test("verify subscription ticket", async t => {
    let session = t.context.session as WampusSession;
    let opts = {
        match: MatchingPolicy.Prefix
    } as WampSubscribeOptions;
    let ticket = await session.topic({
        name: "wampus.example",
        options: opts
    });

    t.is(ticket.isOpen, true);
    t.is(ticket.info.name, "wampus.example");
    t.deepEqual(ticket.info.options, opts);
});

test("close subscription, check event observable", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example"
    });
    await ticket.close();

    t.is(ticket.isOpen, false);
    let last = await ticket.events.toPromise();
    t.falsy(last);
});

test("close registration, closed registration can be closed again and inspected", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example"

    });
    await ticket.close();
    await t.notThrows(() => ticket.close());
    t.true(_.isMatch(ticket.info, {
        name: "wampus.example",
        options: {}
    }));
    t.false(ticket.isOpen);
});

test("close session, subscription should also be closed", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example"
    });
    await session.close();
    t.false(ticket.isOpen);
});

test("verify multi-topic ticket", async t => {
    let session = t.context.session as WampusSession;
    let topics = ["a.b", "c", "d"];
    let ticket = await session.topics(["a.b", "c", "d"]);
    t.falsy(ticket.topic["a-c"]);
    t.true(ticket.isOpen);
    t.truthy(ticket.topic.c);
    for (let topic of topics) {
        let info = ticket.infos[topic];
        t.is(topic, info.name);
        t.deepEqual(info.options, {});
    }
    await ticket.close();
    t.false(ticket.isOpen);
});
