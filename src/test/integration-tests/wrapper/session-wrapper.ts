import test from "ava";
import {Wampus, WampusSession} from "../../../lib/index";
import {SessionStages} from "../../helpers/dummy-session";
import {RealSessions} from "../../helpers/real-sessions";
import {DefaultMessageFactory} from "../../../lib/core/session/default-factory";
import _ = require("lodash");


let factory = DefaultMessageFactory;
test("connect using WS transport", async t => {
	let session = await Wampus.create({
		realm : "library",
		transport : {
			type : "websocket",
			url : "ws://localhost:8080",
			serializer : "json"
		}
	});
	t.true(_.isNumber(session.sessionId));

	await session.register({
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
	let call = session.call({name : "wampus.procedure.promise"});
	t.true(_.isMatch(call.info, {
		name : "wampus.procedure.promise",
		options : {}
	}));
	let result = await call;
	t.deepEqual(result.kwargs, {token : "hi", data :[1,2,3]});
	t.deepEqual(result.args, []);
	t.deepEqual(result.details, {});
	t.deepEqual(result.isProgress, false);
});
