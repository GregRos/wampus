import test from "ava";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {WampType} from "typed-wamp";
import {WampusCoreSession} from "~lib/core/session/core-session";
import {MatchError} from "~test/helpers/error-matchers";
import {timeoutPromise} from "~test/helpers/promises";
import {monitor} from "~test/helpers/rxjs-monitor";

async function publishAck(s: WampusCoreSession) {
    return s.publish({
        name: "a",
        options: {
            acknowledge: true
        }
    });
}

test("should expect reply", async t => {
    let {session} = await SessionStages.handshaken("a");
    let publishing = publishAck(session);
    await t.throwsAsync(timeoutPromise(publishing, 10));
});

test("receive PUBLISHED, resolve", async t => {
    let {session, server} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    let publishing = publishAck(session);
    let publish = await serverMonitor.next();
    server.send([17, publish[1], 100]);
    await t.notThrowsAsync(publishing);
});


function testPublishError(o: { errId: string, errMatch(x: any): boolean, title: string }) {
    test(o.title, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        let serverMonitor = monitor(server.messages);
        let publishing = publishAck(session);
        let publish = await serverMonitor.next();
        server.send([8, WampType.PUBLISH, publish[1], {}, o.errId]);
        let err = await t.throwsAsync(publishing);
        t.true(o.errMatch(err));
    });
}

testPublishError({
    errMatch: MatchError.illegalOperation("URI"),
    errId: "wamp.error.invalid_uri",
    title: "receive ERROR(invalid URI), throw"
});

testPublishError({
    errMatch: MatchError.illegalOperation("whatever"),
    errId: "wamp.error.whatever",
    title: "receive ERROR(custom), throw"
});

test("publish on closing session", async t => {
    let {server, session} = await SessionStages.handshaken("a");

    let expectThrow = t.throwsAsync(session.publish({
        name: "a",
        options: {acknowledge: true}
    }));
    server.send([3, {}, "no"]);
    await session.close();
    let err = await expectThrow;
    t.true(MatchError.network("publishing", "topic")(err));

});
