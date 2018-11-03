import {Wampus} from "../../lib/wrappers/wampus";
import "../../setup";
import {MatchType} from "../../lib/core/protocol/options";
import {yamprint} from "yamprint";
import {WampusSession} from "../../lib/wrappers/wampus-session";
import "yamprint-ansi-color"
import {yp} from "./yamprinter";
import _ = require("lodash");

function printResult(x: any) {
	console.log(yp(_.pick(x, ["args", "kwargs"])) + "\n");
}

function level2() {
	throw Error("BOO");
}

function level1() {
	level2();
}


async function someBasicCalls(session: WampusSession) {
	let procedure = await session.register({
		name: "x2",
		async invocation(x) {
			level1();
			return {
				args: [x.args[0] * 2],
			};
		}
	});

	await procedure.using(async () => {
		{
			let x = await session.call({
				name: "x2",
				args: [20]
			}).catch(err => err);
			console.log(yp(x));
		}
	});
}

export async function main() {
	let session = await Wampus.create({
		realm: "proxy",
		transport: {
			type: "websocket",
			serializer: "json",
			url: "ws://127.0.0.1:9003"
		}
	});

	await someBasicCalls(session);

}

main();