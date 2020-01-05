import {RealSessions} from "../../helpers/real-sessions";
import {WampusSession} from "../../../lib";
import {InvocationPolicy, MatchingPolicy, WampRegisterOptions} from "typed-wamp";
import {isMatch} from "lodash";
import {sessionTest} from "../../helpers/my-test-interface";

sessionTest.beforeEach(async t => {
    t.context = {
        session: await RealSessions.session()
    };
});
sessionTest.afterEach(async t => {
    await t.context.session.close();
});

sessionTest("verify registration ticket", async t => {
    let session = t.context.session as WampusSession;
    let opts = {
        disclose_caller: true,
        match: "prefix",
        invoke: "random"
    } as WampRegisterOptions;
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            return {};
        },
        options: opts
    });

    t.is(ticket.isOpen, true);
    t.is(ticket.info.name, "wampus.example");
    t.deepEqual(ticket.info.options, opts);
});

sessionTest("close registration, try to call to make sure", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            return {};
        }
    });
    let r = await session.call({
        name: ticket.info.name
    });
    t.true(isMatch(r, {
        args: [],
        kwargs: {}
    }));
    await ticket.close();

    await t.throwsAsync(session.call({
        name: ticket.info.name
    }));
});

sessionTest("close registration, closed registration can be closed again and inspected", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            return {};
        }
    });
    await ticket.close();
    await t.notThrows(() => ticket.close());
    t.true(isMatch(ticket.info, {
        name: "wampus.example",
        options: {}
    }));
    t.false(ticket.isOpen);
});

sessionTest("procedures", async t => {
    let session = t.context.session as WampusSession;

    let tickets = await session.procedures({
        async ["wampus.a"](x) {
            return {
                args: ["a"]
            };
        },
        async ["wampus.b"](x) {
            return {
                args: ["b"]
            };
        },
        async ["wampus.c"](x) {
            return {
                args: ["c"]
            };
        },
        "wampus.d.": {
            options: {
                match: "prefix"
            },
            async called(x) {
                return {
                    args: [x.options.procedure]
                };
            }
        }
    });


    t.is((await session.call({name: "wampus.a"})).args[0], "a");
    t.is((await session.call({name: "wampus.b"})).args[0], "b");
    t.is((await session.call({name: "wampus.c"})).args[0], "c");

    let longForm = await session.call({name: "wampus.d.1"});
    t.is(longForm.args[0], "wampus.d.1");
    let longForm2 = await session.call({name: "wampus.d.2"});
    t.is(longForm2.args[0], "wampus.d.2");
    await tickets.close();

    await t.throwsAsync(session.call({name: "wampus.a"}));
});

sessionTest("close session, registration should also be closed", async t => {
    let session = t.context.session as WampusSession;
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            return {};
        }
    });
    await session.close();
    t.false(ticket.isOpen);
});