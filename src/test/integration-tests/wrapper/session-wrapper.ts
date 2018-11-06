import test from "ava";
import {Wampus, WampusConfig, WampusSession} from "../../../lib/index";
import {SessionStages} from "../../helpers/dummy-session";
import {RealSessions} from "../../helpers/real-sessions";
import {DefaultMessageFactory} from "../../../lib/core/session/default-factory";
import _ = require("lodash");
import {WampUri} from "../../../lib/core/protocol/uris";

let factory = DefaultMessageFactory;

function getSession(stuff ?: Partial<WampusConfig>) {
	return Wampus.create({
		realm : "library",
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
});

let x = {
	continue(x){

	}
}

test("register and call, with transforms", async t => {
	class SpecialToken {

	}
	let session = await getSession({
		services(next, old) {
			next.transforms.jsonToObject = json => {
				if (json.token === "special") {
					return new SpecialToken();
				} else {
					return _.mapValues(json, v => next.transforms.jsonToObject(v));
				}
			}
		}
	});

	let ticket = await session.register({
		name : "wampus.procedure",
		async invocation(x) {
			return {
				kwargs : {a : 5}
			}
		}
	});

	ticket.info
})