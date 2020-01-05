import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {MatchingPolicy, WampSubscribeOptions} from "typed-wamp";
import {isMatch} from "lodash";
import {sessionTest} from "../../helpers/my-test-interface";

sessionTest.beforeEach(async t => {
    t.context = {
        session: await RealSessions.session()
    };
});
sessionTest.afterEach(async t => {
    await t.context.session.close();
});

sessionTest("verify subscription ticket", async t => {
    let session = t.context.session as WampusSession;
    let opts = {
        match: "prefix"
    } as WampSubscribeOptions;
    let ticket = await session.topic({
        name: "wampus.example",
        options: opts
    });

    t.is(ticket.isOpen, true);
    t.is(ticket.info.name, "wampus.example");
    t.deepEqual(ticket.info.options, opts);
});

sessionTest("close subscription, check event observable", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example"
    });
    await ticket.close();

    t.is(ticket.isOpen, false);
    let last = await ticket.events.toPromise();
    t.falsy(last);
});

sessionTest("close registration, closed registration can be closed again and inspected", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example"

    });
    await ticket.close();
    await t.notThrows(() => ticket.close());
    t.true(isMatch(ticket.info, {
        name: "wampus.example",
        options: {}
    }));
    t.false(ticket.isOpen);
});

sessionTest("close session, subscription should also be closed", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example"
    });
    await session.close();
    t.false(ticket.isOpen);
});

sessionTest("verify multi-topic ticket", async t => {
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
