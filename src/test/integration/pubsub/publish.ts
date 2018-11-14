import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib/index";
import {MatchType, WampSubscribeOptions} from "../../../lib/core/protocol/options";
import _ = require("lodash");
import {WampusPublishArguments} from "../../../lib/core/session/message-arguments";
import {take} from "rxjs/operators";

test.beforeEach(async t => {
	t.context = {
		session : await RealSessions.session()
	};
});
test.afterEach(async t => {
	await t.context.session.close();
});

test("verify event ticket", async t => {
	let session = t.context.session as WampusSession;

	let ticket = await session.topic({
		name : "wampus.example"
	});

	let justOneEvent = ticket.events.pipe(take(1)).toPromise();

	await session.publish({
		name : ticket.info.name,
		options : {
			exclude_me : false
		},
		args : [1, 2],
		kwargs : {
			a : 1
		}
	});

	let oneEvent = await justOneEvent;

	t.is(oneEvent.source, ticket);
	t.true(_.isMatch(oneEvent, {
		args : [1, 2],
		kwargs : {
			a : 1
		}
	}));
});

