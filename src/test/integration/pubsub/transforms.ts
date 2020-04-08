import {RealSessions} from "../../helpers/real-sessions";
import {take} from "rxjs/operators";
import {isMatch} from "lodash";
import {test} from "../../helpers/my-test-interface";

test.afterEach(async t => {
    await t.context.session.close();
});

class Token {

}


test("publish input, event output", async t => {
    let session = t.context.session = await RealSessions.session({
        services(s) {
            s.out.json.push(ctrl => {
                const x = ctrl.val;
                if (x instanceof Token) return "modified";
                // This is to make sure the array in args isn't transformed:
                if (Array.isArray(x)) return x.length;
                return ctrl.next(x);
            });
        }
    });
    let ticket = await session.topic({
        name: "wampus.example"
    });

    let justOne = ticket.events.pipe(take(1)).toPromise();

    await session.publish({
        name: ticket.info.name,
        args: [new Token()],
        kwargs: {
            a: [1, 2],
            x: new Token()
        },
        options: {
            exclude_me: false
        }
    });

    let x = await justOne;

    t.true(isMatch(x, {
        args: ["modified"],
        kwargs: {
            a: 2,
            x: "modified"
        }
    }));
});

test("publish output, event input", async t => {
    let session = t.context.session = await RealSessions.session({
        services(s) {
            s.in.json.push(ctrl => {
                const x = ctrl.val;
                if (x === "modified") return "original2";
                // This is to make sure the array in args isn't transformed:
                if (Array.isArray(x)) return x.length;
                return ctrl.next(x);
            });
            s.out.json.push(ctrl => {
                const x = ctrl.val;
                if (x === "original") return "modified";

                return ctrl.next(x);
            });
        }
    });

    let ticket = await session.topic({
        name: "wampus.example"
    });

    let justOne = ticket.events.pipe(take(1)).toPromise();

    await session.publish({
        name: ticket.info.name,
        args: ["original", new Token()],
        kwargs: {
            a: "original",
            arr: [1, 2]
        },
        options: {
            exclude_me: false
        }
    });

    let event = await justOne;

    t.assert(isMatch(event, {
        args: ["original2", {}],
        kwargs: {
            a: "original2",
            arr: 2
        }
    }));
});
