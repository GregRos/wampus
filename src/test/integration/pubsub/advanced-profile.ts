import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {MatchingPolicy} from "typed-wamp";
import {take, toArray} from "rxjs/operators";
import {sessionTest} from "../../helpers/my-test-interface";

sessionTest.beforeEach(async t => {
    t.context = {
        session: await RealSessions.session()
    };
});
sessionTest.afterEach(async t => {
    await t.context.session.close();
});

sessionTest("pattern_based_subscription", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.",
        options: {
            match: "prefix"
        }
    });

    let threeEvents = ticket.events.pipe(take(3), toArray()).toPromise();

    let eventNames = ["wampus.a", "wampus.b", "wampus.c"];
    for (let name of eventNames) {
        await session.publish({
            options: {
                exclude_me: false
            },
            name
        });
    }

    let namesOfEvents = (await threeEvents).map(x => x.details.topic);
    t.deepEqual(namesOfEvents, eventNames);
});

sessionTest("publisher_identification", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example",
        options: {}
    });

    let oneEvent = ticket.events.pipe(take(1)).toPromise();

    await session.publish({
        name: "wampus.example",
        options: {
            exclude_me: false,
            disclose_me: true
        }
    });

    let ev = await oneEvent;

    t.is(ev.details.publisher, session.sessionId);
});

sessionTest("subscriber_blackwhite_listing", async t => {

    let session = t.context.session as WampusSession;
    let ticket = await session.topic({
        name: "wampus.example",
        options: {}
    });

    let oneEvent = ticket.events.pipe(take(1)).toPromise();

    await session.publish({
        name: "wampus.example",
        options: {
            exclude_me: false,
            eligible: [session.sessionId]
        }
    });

    await t.notThrowsAsync(oneEvent);
});