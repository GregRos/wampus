import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/rxjs";
import _ = require("lodash");
import {WampType} from "../../../../lib/core/protocol/message.type";

test("should send PUBLISH", async t => {
    let {server,session} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    session.publish({
        name : "a",
        args : ["1"],
        kwargs : {
            a : 2
        }
    });
    let msg = await serverMonitor.next();
    t.true(_.isMatch(msg, {
        0 : 16,
        2 : {},
        3 : "a",
        4 : ["1"],
        5 : {a : 2}
    }));
    t.falsy(await serverMonitor.nextWithin(10), "sent extra message");

});

test("should not want any reply (acknowledge=false)", async t => {
    let {server,session} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    await t.notThrows(session.publish({name : "a"}));
});