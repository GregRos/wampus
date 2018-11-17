import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {MyPromise} from "../../../lib/utils/ext-promise";
import {yp} from "../../usability/yamprinter";
import {MatchingPolicy} from "../../../lib/core/protocol/options";

test.beforeEach(async t => {
	t.context = {
		session: await RealSessions.session()
	};
});
test.afterEach(async t => {
	await t.context.session.close();
});
test("call_timeout", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			await MyPromise.wait(400);

			let token = await x.waitForCancel(0);
			if (token) {
				return {args : [true]};
			} else {
				return {args : [false]}
			}
		}
	});

	let result = await session.call({
		name : ticket.info.name,
		options : {
			timeout : 200
		}
	});
	t.true(result.args[0]);
});

test("caller_identification", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			t.is(x.options.caller, session.sessionId);
			return {};
		}
	});

	await session.call({
		name : ticket.info.name,
		options : {
			disclose_me : true,

		}
	});
});

test("pattern registration", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.register({
		name : "wampus.example",
		options : {
			match : MatchingPolicy.Prefix
		},
		async called(x) {
			t.is(x.options.procedure, x.args[0]);
			return {};
		}
	});

	await t.notThrows(session.call({
		name : `${ticket.info.name}.1`,
		get args() {
			return [this.name];
		}
	}));

	await t.notThrows(session.call({
		name : `${ticket.info.name}.a.b.c`,
		get args() {
			return [this.name];
		}
	}));
});