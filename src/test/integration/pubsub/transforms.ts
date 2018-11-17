import test from "ava";
import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {InvocationTicket} from "../../../lib/wrappers/tickets/invocation-ticket";
import _ = require("lodash");
import {take} from "rxjs/operators";

test.afterEach(async t => {
	await t.context.session.close();
});

class Token {

}


test("publish input, event output", async t => {
	let session = t.context.session = await RealSessions.session({
		services(s) {
			s.transforms.objectToJson.add((x,ctrl) => {

				if (x instanceof Token) return "modified";
				// This is to make sure the array in args isn't transformed:
				if (Array.isArray(x)) return x.length;
				return ctrl.next(x);
			})
		}
	});
	let ticket = await session.topic({
		name : "wampus.example",
	});

	let justOne = ticket.events.pipe(take(1)).toPromise();

	await session.publish({
		name : ticket.info.name,
		args : [new Token()],
		kwargs : {
			a : [1, 2],
			x : new Token()
		},
		options : {
			exclude_me : false
		}
	});

	let x = await justOne;

	t.true(_.isMatch(x, {
		args : ["modified"],
		kwargs : {
			a : 2,
			x : "modified"
		}
	}));
});

test("publish output, event input", async t => {
	let session = t.context.session = await RealSessions.session({
		services(s) {
			s.transforms.jsonToObject.add((x,ctrl) => {
				if (x === "modified") return "original2";
				// This is to make sure the array in args isn't transformed:
				if (Array.isArray(x)) return x.length;
				return ctrl.next(x);
			});
			s.transforms.objectToJson.add((x, ctrl) => {
				if (x === "original") return "modified";

				return ctrl.next(x);
			})
		}
	});

	let ticket = await session.topic({
		name : "wampus.example"
	});

	let justOne = ticket.events.pipe(take(1)).toPromise()

	await session.publish({
		name : ticket.info.name,
		args : ["original", new Token()],
		kwargs : {
			a : "original",
			arr : [1, 2]
		},
		options : {
			exclude_me : false
		}
	});

	let event = await justOne;

	t.true(_.isMatch(event, {
		args : ["original2", {}],
		kwargs : {
			a : "original2",
			arr : 2
		}
	}));
});