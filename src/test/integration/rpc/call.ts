import test from "ava";
import {WampusSession} from "../../../lib";
import {InvocationTicket, ProcedureHandler} from "../../../lib/wrappers/tickets/invocation-ticket";
import {WampCallOptions} from "typed-wamp";
import {RealSessions} from "../../helpers/real-sessions";
import {toArray} from "rxjs/operators";
import {WampusSendResultArguments} from "../../../lib/core/session/message-arguments";
import {WampusInvocationError} from "../../../lib/core/errors/types";
import {MatchError} from "../../helpers/errors";
import {MyPromise} from "../../../lib/utils/ext-promise";
import {isMatch} from "lodash";

test.beforeEach(async t => {
    t.context = {
        session: await RealSessions.session()
    };
});
test.afterEach(async t => {
    await t.context.session.close();
});

test("verify call ticket", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            return {};
        }
    });

    let copts = {
        disclose_me: true,
        receive_progress: true,
        timeout: 1000
    } as WampCallOptions;

    let ct = session.call({
        name: ticket.info.name,
        options: copts
    });

    t.true(isMatch(ct.info, {
        options: copts,
        name: ticket.info.name
    }));
});


test("verify invocation ticket", async t => {
    let session = t.context.session as WampusSession;
    let lastInvocation = null as InvocationTicket;
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            lastInvocation = x;
            return {};
        }
    });

    let ct = await session.call({
        name: ticket.info.name
    });

    t.true(lastInvocation.isHandled);
    t.is(lastInvocation.name, ticket.info.name);
    t.deepEqual(lastInvocation.args, []);
    t.deepEqual(lastInvocation.kwargs, {});
    t.true(isMatch(lastInvocation.options, {
        receive_progress: true
    }));
});

test("verify result data", async t => {
    let session = t.context.session as WampusSession;
    let result: WampusSendResultArguments = {
        args: [1, 100, 50],
        kwargs: {
            a: "hi",
            c: {
                d: 1
            }
        }
    };
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            return result;
        }
    });

    let cTicket = session.call({
        name: ticket.info.name
    });
    let cResult = await cTicket.result;

    t.deepEqual(cResult.args, result.args);
    t.deepEqual(cResult.kwargs, result.kwargs);
    t.false(cResult.isProgress);
    t.is(cResult.source, cTicket);

});

test("throw in handler translates to error response", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            throw Object.assign(new Error("AnError"), {
                a: 1,
                b: [2]
            });
        }
    });

    let cTicket = session.call({
        name: ticket.info.name
    });
    let cResult = await cTicket.result.catch(x => x);
    let err = cResult as WampusInvocationError;
    t.true(err.message.includes("procedure"));
    t.is(err.error, "wamp.error.runtime_error");
    t.is(err.details.message, "AnError");
    t.deepEqual(err.args, []);
    t.true(isMatch(err.kwargs, {
        message: "AnError",
        name: "Error",
        a: 1,
        b: [2]
    }));
    t.deepEqual(cResult.args, []);
});

test("send progress", async t => {
    let session = t.context.session as WampusSession;

    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            await x.progress({
                args: [1],
                kwargs: {a: 1}
            });

            await x.progress({
                args: [2],
                kwargs: {a: 2}
            });

            return {
                args: [3],
                kwargs: {a: 3}
            };
        }
    });

    let results = await session.call({
        name: ticket.info.name
    }).progress.pipe(toArray()).toPromise();

    function matchProgress(obj, num) {
        t.true(isMatch(obj, {
            args: [num],
            kwargs: {
                a: num
            }
        }));
    }

    matchProgress(results[0], 1);
    matchProgress(results[1], 2);
    matchProgress(results[2], 3);
});

test("send and receive cancel", async t => {
    let session = t.context.session as WampusSession;

    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            await MyPromise.wait(500);
            let cancel = await x.waitForCancel(0);
            cancel.throw();
            return {};
        }
    });

    let results = session.call({
        name: ticket.info.name
    });

    await MyPromise.wait(250);

    t.true(results.isOpen);

    await results.close();
    await t.throws(results, MatchError.cancelled());

});

test("progress via event", async t => {
    let session = t.context.session as WampusSession;

    let data = [];
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            await x.progress({
                args: [1]
            });

            await x.progress({
                args: [2]
            });

            await x.progress({
                args: [3]
            });

            return {
                args: [4]
            };
        }
    });

    let call = session.call({
        name: ticket.info.name
    });

    let handler = x => {
        data.push(x);
        if (data.length === 3) call.off("data", handler);
    };

    call.on("data", handler);

    await call;

    t.deepEqual(data.map(x => x.args[0]), [1, 2, 3]);
});