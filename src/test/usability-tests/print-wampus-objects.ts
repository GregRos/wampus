import {SessionStages} from "../helpers/wamp";
import {Wampus, WampusSession} from "../../lib";

async function run() {
	let session = await Wampus.create({
		realm : "library",
		transport : {
			type : "websocket",
			url : "ws://localhost:8080",
			serializer : "json"
		}
	});

	await session.register({
		name : "test"
	}, async x => {
		console.log("invocation", x);
		return {
			kwargs : {a : 1},
			args : [1, 2, 5]
		};
	});

	let x = await session.call({
		name : "test"
	});
	console.log(x);
}

run();