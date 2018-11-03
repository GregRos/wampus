import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/observable-monitor";
import _ = require("lodash");
import {WampType} from "../../../../lib/core/protocol/message.type";
import {WampusCoreSession} from "../../../../lib/core/session/core-session";
import {Operators} from "promise-stuff";
import {MatchError} from "../../../helpers/errors";

async function publishAck(s : WampusCoreSession) {
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


function testPublishError(o : {errId : string, errMatch : (x : any) => boolean, title : string}) {
    test(o.title, async t => {
        let {session,server} = await SessionStages.handshaken("a");
        let serverMonitor = Rxjs.monitor(server.messages);
        let publishing = publishAck(session);
        let publish = await serverMonitor.next();
        server.send([8, WampType.PUBLISH, publish[1], {}, o.errId]);
        await t.throws(publishing, o.errMatch);
    });
}

testPublishError({
    errMatch :  MatchError.illegalOperation("URI"),
    errId : "wamp.error.invalid_uri",
    title : "receive ERROR(invalid URI), throw"
});

test("publish on closing session", async t => {
    let {server,session} = await SessionStages.handshaken("a");
    let serverMonitor = Rxjs.monitor(server.messages);
    let expectThrow = t.throws(session.publish({name : "a", options : {acknowledge : true}}), MatchError.network("publishing", "topic"));
    server.send([3, {}, "no"]);
    await session.close();
    await expectThrow;
});