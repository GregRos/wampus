import test from "ava";
import {count} from "rxjs/operators";
import {isWampusNetErr} from "../../../helpers/misc";
import {Shorthand} from "../../../helpers/wamp";


async function getRegularGoodbyedSession() {
    let {session,server} = await Shorthand.getSessionPostHandshake("a");
    let sbs = Shorthand.stepListenObservable(server.events);
    let p = session.close();
    let goodbye = await sbs.next();
    server.send([6, {}, "wamp.close.goodbye_and_out"]);
    await p;
    return session;
}

test("basic properties of a session in a closed state", async t => {
    let sess = await getRegularGoodbyedSession();
    t.is(sess.isActive, false);
    await t.throws(sess.call({name : "hi"}).progress.toPromise(), isWampusNetErr("closed"));
    await t.throws(sess.register({name : "hi"}), isWampusNetErr("closed"));
    await t.throws(sess.publish({name : "hi"}), isWampusNetErr("closed"));
    await t.throws(sess.event({name : "hi"}), isWampusNetErr("closed"));
});