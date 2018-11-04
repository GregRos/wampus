import test from "ava";
import {Wampus, WampusSession} from "../../../lib";
import {SessionStages} from "../../helpers/wamp";

test("connect", t => {
	let session = SessionStages.handshaken("hi");
	t.pass();

});