import test from "ava";
import {SessionStages} from "../../../helpers/dummy-session";
import {MatchError} from "../../../helpers/errors";
import {Feature} from "../../../../lib/core/protocol/feature-names";

test("disclose me fails when feature is not declared", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let prog = session.call({
        name: "a",
        options: {
            disclose_me: true
        }
    });
    await t.throws(prog.progress.toPromise(), MatchError.illegalOperation("CallerIdentification"));
});

test("timeout fails when feature not declared", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let prog = session.call({
        name: "a",
        options: {
            timeout: 5000
        }
    });
    await t.throws(prog.progress.toPromise(), MatchError.illegalOperation("CallTimeout"));
});

test("progressive call results request fails when feature not declared", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let prog = session.call({
        name: "a",
        options: {
            receive_progress: true
        }
    });
    await t.throws(prog.progress.toPromise(), MatchError.illegalOperation(Feature.Call.ProgressReports));
});

