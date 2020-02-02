import {RealSessions} from "../../helpers/real-sessions";
import {isMatch} from "lodash";
import {test} from "../../helpers/my-test-interface";

test.afterEach(async t => {
    await t.context.session.close();
});

class Token {

}


test("call input, invocation output", async t => {
    let session = t.context.session = await RealSessions.session({
        services(s) {
            s.out.json.pre(ctrl => {
                const x = ctrl.val;
                if (x instanceof Token) return "modified";
                // This is to make sure the array in args isn't transformed:
                if (Array.isArray(x)) return x.length;
                return ctrl.next(x);
            });
        }
    });
    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            t.true(isMatch(x, {
                kwargs: {
                    arr: 2,
                    str: "modified"
                },
                args: ["modified", {}]
            }));
            return {
                args: [new Token(), {}],
                kwargs: {
                    a: {
                        x: new Token(),
                        arr: [1, 2]
                    }
                }
            };
        }
    });

    let result = await session.call({
        name: ticket.info.name,
        kwargs: {
            arr: [1, 2],
            str: new Token()
        },
        args: [new Token(), {}]
    });

    t.true(isMatch(result, {
        kwargs: {
            a: {
                x: "modified",
                arr: 2
            }
        },
        args: ["modified", {}]
    }));
});

test("call output, invocation input", async t => {
    let session = t.context.session = await RealSessions.session({
        services(s) {
            s.in.json.pre(ctrl => {
                const x = ctrl.val;
                if (x === "modified") return "original2";
                // This is to make sure the array in args isn't transformed:
                if (Array.isArray(x)) return x.length;
                return ctrl.next(x);
            });
            s.out.json.pre(ctrl => {
                const x = ctrl.val;
                if (x === "original") return "modified";

                return ctrl.next(x);
            });
        }
    });

    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            t.true(isMatch(x, {
                args: ["original2"],
                kwargs: {
                    a: "original2",
                    arr: 2
                }
            }));
            return {
                args: ["original", new Token()],
                kwargs: {
                    a: {
                        x: "original",
                        arr: [1, 2]
                    }
                }
            };
        }
    });

    let result = await session.call({
        name: ticket.info.name,
        args: ["original"],
        kwargs: {
            a: "original",
            arr: [1, 2]
        }
    });

    t.true(isMatch(result, {
        args: ["original2", {}],
        kwargs: {
            a: {
                x: "original2",
                arr: 2
            }
        }
    }));

});

class MySpecialError extends Error {
    kwargsName: string;
    args1: string;
    optionsName: string;
}

test("invocation error to error response", async t => {
    let session = t.context.session = await RealSessions.session({
        services(s) {
            s.in.error.pre(ctrl => {
                const x = ctrl.val;
                if (x.error === "wampus.my_special_error") {
                    return Object.assign(new MySpecialError(), {
                        kwargsName: x.kwargs.name,
                        args1: x.args[0],
                        optionsName: x.details.name,
                        message: x.args[1]
                    });
                }
                return ctrl.next(x);
            });

            s.out.error.pre(ctrl => {
                const x = ctrl.val;
                if (x instanceof MySpecialError) {
                    return {
                        kwargs: {
                            name: x.kwargsName
                        },
                        args: [x.args1, x.message],
                        error: "wampus.my_special_error",
                        details: {
                            name: x.optionsName
                        }
                    };
                }
            });
        }
    });

    let args = {
        message: "a",
        kwargsName: "b",
        args1: "c",
        optionsName: "d"
    };

    let ticket = await session.procedure({
        name: "wampus.example",
        async called(x) {
            throw Object.assign(new MySpecialError("Hi"), args);
        }
    });

    let call: MySpecialError = await session.call({
        name: ticket.info.name
    }).result.catch(x => x);

    t.true(call instanceof MySpecialError);
    t.is(call.optionsName, args.optionsName);
    t.is(call.args1, args.args1);
    t.is(call.kwargsName, args.kwargsName);
    t.is(call.message, args.message);
});
