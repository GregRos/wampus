import test from "ava";
import {count} from "rxjs/operators";
import {MatchError} from "../../../helpers/errors";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/observable-monitor";


async function getRegularGoodbyedSession() {
    let {session,server} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.events);
    let p = session.close();
    let goodbye = await sbs.next();
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    await p;
    return session;
}

test("basic properties of a session in a closed state", async t => {
    let sess = await getRegularGoodbyedSession();
    t.is(sess.isActive, false);
    await t.throws(sess.call({name : "hi"}).progress.toPromise(), MatchError.network("closed"));
    await t.throws(sess.register({name : "hi"}), MatchError.network("closed"));
    await t.throws(sess.publish({name : "hi"}), MatchError.network("closed"));
    await t.throws(sess.event({name : "hi"}), MatchError.network("closed"));
});