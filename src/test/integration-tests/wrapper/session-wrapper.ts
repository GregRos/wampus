import test from "ava";
import {Wampus, WampusConfig, WampusSession} from "../../../lib/index";
import {SessionStages} from "../../helpers/dummy-session";
import {RealSessions} from "../../helpers/real-sessions";
import {DefaultMessageFactory} from "../../../lib/core/session/default-factory";
import _ = require("lodash");
import {WampUri} from "../../../lib/core/protocol/uris";

let factory = DefaultMessageFactory;

let randomRealm = () => {
	return ( Math.random() * 100000).toString(36);
}
function getSession(stuff ?: Partial<WampusConfig>) {
	return Wampus.create({
		realm : randomRealm(),
		transport : {
			type : "websocket",
			url : "ws://localhost:8080",
			serializer : "json"
		},
		...(stuff || {})
	});
}
test("register, call, and then close registration", async t => {
	let session = await getSession();
	t.true(_.isNumber(session.sessionId));
	let ticket = await session.register({
		name : "wampus.procedure.promise",
		async invocation(x) {
			return {
				kwargs : {
					token : "hi",
					data : [1, 2, 3]
				},
				options: {}
			}
		}
	});
	t.true(ticket.isOpen);
	t.true(_.isMatch(ticket.info, {
		name : "wampus.procedure.promise",
		options : {}
	}));
	t.truthy(ticket.trace.created);
	let call = session.call({name : ticket.info.name});
	t.true(_.isMatch(call.info, {
		name : ticket.info.name,
		options : {}
	}));
	let result = await call;
	t.deepEqual(result.kwargs, {token : "hi", data :[1,2,3]});
	t.deepEqual(result.args, []);
	t.deepEqual(result.details, {});
	t.deepEqual(result.isProgress, false);
	await ticket.close();
	t.false(ticket.isOpen);
	await t.throws(session.call({name : ticket.info.name}));
	await session.close();
});

test("add transforms, register, call, ", async t => {
	let session = await getSession({
		services(s) {
			s.transforms.objectToJson.add((x, ctrl) => {
				if (x === 5) {
					return 7;
				}
				return ctrl.next(x);
			});
		}
	});
	t.true(_.isNumber(session.sessionId));
	let lastInvocation = null;
	let ticket = await session.register({
		name : "wampus.procedure.promise",
		async invocation(x) {
			lastInvocation = x;
			return {
				args : x.args,
				kwargs:  x.kwargs
			}
		}
	});

	let result = await session.call({
		name : ticket.info.name,
		args : [{
			a: 1000
		}, {
			b : 5
		}],
		kwargs : {

			data : 5,
			a1 : {
				a2 : {
					a3 : 5
				}
			}
		}
	});

	t.deepEqual(lastInvocation.kwargs, {
		data : 7,
		a1 : {
			a2 : {
				a3 : 7
			}
		}
	});
	t.deepEqual(lastInvocation.args, [
		{a : 1000},
		{b : 7}
	])

});
