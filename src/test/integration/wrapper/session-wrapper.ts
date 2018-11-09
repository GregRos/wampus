import test from "ava";
import {AbstractWampusSessionServices, Wampus, WampusConfig, WampusSession} from "../../../lib/index";
import {SessionStages} from "../../helpers/dummy-session";
import {RealSessions} from "../../helpers/real-sessions";
import {DefaultMessageFactory} from "../../../lib/core/session/default-factory";
import _ = require("lodash");
import {WampUri} from "../../../lib/core/protocol/uris";
import {Routes} from "../../../lib/core/protocol/routes";
import invocation = Routes.invocation;

let factory = DefaultMessageFactory;



test("register, call, and then close registration", async t => {
	let session = await getSession();
	t.true(_.isNumber(session.sessionId));
	let ticket = await session.register({
		name: "wampus.procedure.promise",
		async called(x) {
			return {
				kwargs: {
					token: "hi",
					data: [1, 2, 3]
				},
				options: {}
			}
		}
	});
	t.true(ticket.isOpen);
	t.true(_.isMatch(ticket.info, {
		name: "wampus.procedure.promise",
		options: {}
	}));
	t.truthy(ticket.trace.created);
	let call = session.call({name: ticket.info.name});
	t.true(_.isMatch(call.info, {
		name: ticket.info.name,
		options: {}
	}));
	let result = await call;
	t.deepEqual(result.kwargs, {token: "hi", data: [1, 2, 3]});
	t.deepEqual(result.args, []);
	t.deepEqual(result.details, {});
	t.deepEqual(result.isProgress, false);
	await ticket.close();
	t.false(ticket.isOpen);
	await t.throws(session.call({name: ticket.info.name}));
	await session.close();
});

function transformOutServices(s : AbstractWampusSessionServices) {
	s.transforms.objectToJson.add((x, ctrl) => {
		if (x === "original") {
			return "modified";
		}
		return ctrl.next(x);
	});
	s.transforms.objectToJson.add((x, ctrl) => {
		if (Array.isArray(x)) {
			return x.length;
		}
		return ctrl.next(x);
	});
}

test("transform applies to call input, invocation output", async t => {
	let session = await getSession({
		services : transformOutServices
	});
	t.true(_.isNumber(session.sessionId));
	let lastInvocation = null;
	let ticket = await session.register({
		name: "wampus.procedure.promise",
		async called(x) {
			lastInvocation = x;
			return {
				args : [1, 2, 3],
				kwargs : {
					a : "original"
				}
			}
		}
	});

	let result1 = await session.call({
		name: ticket.info.name,
		args: [{
			data: "original",
			x : [1, 2]
		}],
		kwargs: {
			a: {
				b: {
					c: "original"
				}
			}
		}
	});
	t.true(_.isMatch(lastInvocation, {
		args : [{
			data : "modified",
			x : 2
		}],
		kwargs : {
			a : {
				b : {
					c : "modified"
				}
			}
		}
	}));
	t.true(_.isMatch(result1, {
		args : [1, 2, 3],
		kwargs : {
			a : "modified"
		}
	}));
});

test("objectToJson transform: call ", async t => {
	let session = await getSession({
		services(s) {
			s.transforms.objectToJson.add((x, ctrl) => {
				if (x === "original") {
					return "modified";
				}
				return ctrl.next(x);
			});
			s.transforms.objectToJson.add((x, ctrl) => {
				if (Array.isArray(x)) {
					return x.length;
				}
				return ctrl.next(x);
			});
		}
	});
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			return {
				args : [1, 2, 3],
				kwargs : {
					a : "original",
					arr :[1, 2]
				}
			}
		}
	});
	let result3 = await session.call({
		name : ticket.info.name
	});
	t.deepEqual(_.pick(result3, "args", "kwargs"), {
		args : [1, 2, 3],
		kwargs :{
			a : "modified",
			arr : 2
		}
	});
});

test("transform applies to call output", async t => {
	let session = await getSession({
		services(s) {
			s.transforms.jsonToObject.add((x, ctrl) => {
				if (x === "original") {
					return "modified";
				}
				return ctrl.next(x);
			});
			s.transforms.jsonToObject.add((x, ctrl) => {
				if (Array.isArray(x)) {
					return x.length;
				}
				return ctrl.next(x);
			});
		}
	});
	let ticket = await session.register({
		name : "wampus.example",
		async called(x) {
			return {
				args : [1, 2, 3],
				kwargs : {
					a : "original"
				}
			}
		}
	});
	let result3 = await session.call({
		name : ticket.info.name
	});

	t.deepEqual(_.pick(result3, "args", "kwargs"), {
		args : [1, 2, 3],
		kwargs : {
			a : "modified"
		}
	});
});

