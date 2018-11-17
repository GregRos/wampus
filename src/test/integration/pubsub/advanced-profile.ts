import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {MatchingPolicy} from "../../../lib/core/protocol/options";
import {take, toArray} from "rxjs/operators";
import {AdvProfile} from "../../../lib/core/protocol/uris";

test.beforeEach(async t => {
	t.context = {
		session: await RealSessions.session()
	};
});
test.afterEach(async t => {
	await t.context.session.close();
});

test("pattern_based_subscription", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.topic({
		name: "wampus.",
		options: {
			match: MatchingPolicy.Prefix
		}
	});

	let threeEvents = ticket.events.pipe(take(3), toArray()).toPromise();

	let eventNames = ["wampus.a", "wampus.b", "wampus.c"]
	for (let name of eventNames) {
		await session.publish({
			options: {
				exclude_me: false
			},
			name: name
		});
	}

	let namesOfEvents = (await threeEvents).map(x => x.details.topic);
	t.deepEqual(namesOfEvents, eventNames)
});

test("publisher_identification", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.topic({
		name: "wampus.example",
		options : {

		}
	});

	let oneEvent = ticket.events.pipe(take(1)).toPromise();

	await session.publish({
		name : "wampus.example",
		options : {
			exclude_me : false,
			disclose_me : true
		}
	});

	let ev = await oneEvent;

	t.is(ev.details.publisher, session.sessionId);
});

test("subscriber_blackwhite_listing", async t => {

	let session = t.context.session as WampusSession;
	let ticket = await session.topic({
		name: "wampus.example",
		options : {

		}
	});

	let oneEvent = ticket.events.pipe(take(1)).toPromise();

	await session.publish({
		name : "wampus.example",
		options : {
			exclude_me : false,
			eligible : [session.sessionId]
		}
	});

	await t.notThrows(oneEvent);
});