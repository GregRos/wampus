import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {InvocationPolicy, MatchType, WampRegisterOptions} from "../../../lib/core/protocol/options";
import _ = require("lodash");

test.beforeEach(async t => {
	t.context = {
		session : await RealSessions.session()
	};
});
test.afterEach(async t => {
	await t.context.session.close();
});

test("verify registration ticket", async t => {
	let session = t.context.session as WampusSession;
	let opts = {
		disclose_caller : true,
		match : MatchType.Prefix,
		invoke : InvocationPolicy.Random
	} as WampRegisterOptions
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			return {};
		},
		options : opts
	});

	t.is(ticket.isOpen, true);
	t.is(ticket.info.name, "wampus.example");
	t.deepEqual(ticket.info.options, opts);
});

test("close registration, try to call to make sure", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			return {};
		}
	});
	let r = await session.call({
		name : ticket.info.name
	});
	t.true(_.isMatch(r, {
		args : [],
		kwargs : {}
	}));
	await ticket.close();

	await t.throws(session.call({
		name : ticket.info.name
	}));
});

test("close registration, closed registration can be closed again and inspected", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			return {};
		}
	});
	await ticket.close();
	await t.notThrows(() => ticket.close());
	t.true(_.isMatch(ticket.info, {
		name : "wampus.example",
		options : {}
	}));
	 t.false(ticket.isOpen);
});

test("close session, registration should also be closed", async t => {
	let session = t.context.session as WampusSession;
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			return {};
		}
	});
	await session.close();
	t.false(ticket.isOpen);
});