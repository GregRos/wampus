import test from "ava";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {WampusNetworkError} from "~lib/core/errors/types";
import {monitor} from "~test/helpers/rxjs-monitor";


async function getRegularGoodbyedSession() {
    let {session, server} = await SessionStages.handshaken("a");
    let sbs = monitor(server.events);
    let p = session.close();
    let goodbye = await sbs.next();
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    await p;
    return session;
}

test("basic properties of a session in a closed state", async t => {
    let sess = await getRegularGoodbyedSession();
    t.is(sess.isActive, false);
    let err = await t.throwsAsync(sess.call({name: "hi"}).progress.toPromise());
    t.true(err instanceof WampusNetworkError);
    t.true(err.message.includes("closed"));

    let err2 = await t.throwsAsync(sess.register({name: "hi"}));
    t.true(err2 instanceof WampusNetworkError);
    t.true(err2.message.includes("closed"));

    let err3 = await t.throwsAsync(sess.publish({name: "hi"}));
    t.true(err3 instanceof WampusNetworkError);
    t.true(err3.message.includes("closed"));

    let err4 = await t.throwsAsync(sess.topic({name: "hi"}));
    t.true(err4 instanceof WampusNetworkError);
    t.true(err4.message.includes("closed"));
});
