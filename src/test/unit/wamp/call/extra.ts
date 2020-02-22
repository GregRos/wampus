import test from "ava";
import {SessionStages} from "~test/helpers/dummy-session";
import {Feature} from "~lib/core/protocol/feature-names";
import {WampusIllegalOperationError} from "~lib/core/errors/types";

test("disclose me fails when feature is not declared", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let prog = session.call({
        name: "a",
        options: {
            disclose_me: true
        }
    });
    let err = await t.throwsAsync(prog.progress.toPromise());
    t.assert(err instanceof WampusIllegalOperationError);
    t.assert(err.message.includes("CallerIdentification"));
});

test("timeout fails when feature not declared", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let prog = session.call({
        name: "a",
        options: {
            timeout: 5000
        }
    });
    let err = await t.throwsAsync(prog.progress.toPromise());
    t.assert(err instanceof WampusIllegalOperationError);
    t.assert(err.message.includes("CallTimeout"));
});

test("progressive call results request fails when feature not declared", async t => {
    let {session, server} = await SessionStages.handshaken("a");

    let prog = session.call({
        name: "a",
        options: {
            receive_progress: true
        }
    });
    let err = await t.throwsAsync(prog.progress.toPromise());
    t.assert(err instanceof WampusIllegalOperationError);
    t.assert(err.message.includes(Feature.Call.ProgressReports));
});

