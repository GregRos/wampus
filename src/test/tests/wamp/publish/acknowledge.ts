import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/rxjs";
import _ = require("lodash");
import {WampType} from "../../../../lib/protocol/message.type";
import {Session} from "../../../../lib/core/session";
import {Operators} from "promise-stuff";
import {MatchError} from "../../../helpers/errors";

async function publishAck(s : Session) {
    return s.publish({
        name : "a",
        options : {
            acknowledge : true
        }
    });
}

test("should expect reply", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let publishing = publishAck(session);
    await t.throws(Operators.timeout(publishing, 10));
});

test("receive PUBLISHED, resolve", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let publishing = publishAck(session);
    let publish = await serverMonitor.next();
    server.send([17, publish[1], 100]);
    await t.notThrows(publishing);
});

test("receive ERROR(invalid URI), throw", async t => {
    let {session,server} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let publishing = publishAck(session);
    let publish = await serverMonitor.next();
    server.send([8, WampType.PUBLISH, publish[1], {}, "wamp.error.invalid_uri"]);
    await t.throws(publishing, MatchError.illegalOperation("URI"));
});