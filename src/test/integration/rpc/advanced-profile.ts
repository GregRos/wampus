import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {MyPromise} from "../../../lib/utils/ext-promise";
import {yp} from "../../usability/yamprinter";
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
	console.log(yp(result));
})