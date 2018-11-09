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

async function someBasicCalls(session: WampusSession) {
	let procedure = await session.register({
		name: "x2",
		async called(x) {
			return {
				args: [x.args[0] * 2],
			};
		}
	},);

	await procedure.using(async () => {
		{
			let x = await session.call({
				name: "x2",
				args: [20]
			})
			printResult(x);
		}
	});

	let complexObjectProc = await session.register({
		name: "enrich-object",
		async called({kwargs}) {
			let ret = {
				embedded: kwargs,
				more: {
					a: 1
				}
			};
			return {
				kwargs: ret
			};
		}
	});

	await complexObjectProc.using(async () => {
		let x = await session.call({
			name: "enrich-object",
			kwargs: {
				x: 1,
				b: ["a", "b"]
			}
		});
		printResult(x);
	})
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