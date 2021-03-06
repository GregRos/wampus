import test from "ava";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {MatchError} from "~test/helpers/error-matchers";
import {isMatch} from "lodash";
import {monitor} from "~test/helpers/rxjs-monitor";

test("should send PUBLISH", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let serverMonitor = monitor(server.messages);
    // tslint:disable-next-line:no-floating-promises
    session.publish({
        name: "a",
        args: ["1"],
        kwargs: {
            a: 2
        }
    });
    let msg = await serverMonitor.next();
    t.true(isMatch(msg, {
        0: 16,
        2: {},
        3: "a",
        4: ["1"],
        5: {a: 2}
    }));
    t.falsy(await serverMonitor.nextWithin(10), "sent extra message");

});

test("should not want any reply (acknowledge=false)", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    monitor(server.messages);
    await t.notThrowsAsync(session.publish({name: "a"}));
});

test("publish on closed session.", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    monitor(server.messages);
    server.send([3, {}, "no"]);
    await session.close();
    let err = await t.throwsAsync(session.publish({name: "a"}));
    await t.true(MatchError.network("publish", "session", "closed")(err));
});

