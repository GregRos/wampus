import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {WampType} from "../../../../lib/protocol/message.type";
import _ = require("lodash");
import {choose} from "../../../../lib/utils/rxjs";
import {WampCallOptions} from "../../../../lib/protocol/options";
import {take, toArray} from "rxjs/operators";
import all = When.all;
import {CallProgress} from "../../../../lib/core/api-types";
import {Observable} from "rxjs";
import {WampResult} from "../../../../lib/core/methods/methods";
import {Rxjs} from "../../../helpers/rxjs";
import {MatchError} from "../../../helpers/errors";
import {WampusIllegalOperationError, WampusInvocationError} from "../../../../lib/errors/types";

test("call sends CALL message", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cr = session.call({
        name: "a",
        args : [1],
        kwargs : {
            a : 5
        }
    });
    t.true(_.isMatch(await sbs.next(), {
        0: WampType.CALL,
        1 : cr.requestId,
        2: {},
        3: "a",
        4 : [1],
        5 : {a : 5}
    }));
});

function arrify<T>(rx : Observable<T>) {
    return rx.pipe(toArray()).toPromise();
}

test("send CALL, receive final RESULT, report result to caller, verify progress stream", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cp = session.call({
        name: "a",
        args : [1],
        kwargs : {
            a : 5
        }
    });
    await sbs.next();
    server.send([WampType.RESULT, cp.requestId, {}, ["a"], {a : 5}]);
    let allProgress = await cp.progress().pipe(toArray()).toPromise();
    t.true(_.isMatch(allProgress, [{
        isProgress : false,
        kwargs : {a : 5},
        args : ["a"],
        name : "a",
    }] as typeof allProgress))
});

test("send 2 identical calls, receive RESULTs, verify progress streams", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cp1 = session.call({
        name: "a"
    });
    let cp2 = session.call({
        name : "a"
    });
    await sbs.nextK(2);
    server.send([WampType.RESULT, cp1.requestId, {}, null, {a : 1}]);
    server.send([WampType.RESULT, cp2.requestId, {}, null, {a : 2}]);
    let pr1 = await arrify(cp1.progress());
    let pr2 = await arrify(cp2.progress());
    t.deepEqual(pr1.map(x => x.kwargs), [{a : 1}])
    t.deepEqual(pr2.map(x => x.kwargs), [{a : 2}])
});

test("make 2 different calls, receive RESULTs, verify progress streams", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cp1 = session.call({
        name: "a"
    });
    let cp2 = session.call({
        name : "b"
    });
    await sbs.nextK(2);
    server.send([WampType.RESULT, cp1.requestId, {}, null, {a : 1}]);
    server.send([WampType.RESULT, cp2.requestId, {}, null, {a : 2}]);
    let pr1 = await arrify(cp1.progress());
    let pr2 = await arrify(cp2.progress());
    t.deepEqual(pr1.map(x => x.kwargs), [{a : 1}]);
    t.deepEqual(pr2.map(x => x.kwargs), [{a : 2}]);
});

test("send CALL, receive ERROR(procedure doesn't exist), throw", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cp1 = session.call({
        name: "a"
    });
    await sbs.next();
    server.send([WampType.ERROR, WampType.CALL, cp1.requestId, {}, "wamp.error.no_such_procedure", ["a"], {a : 1}]);
    await t.throws(cp1.progress().toPromise(), MatchError.illegalOperation("Procedure", "exist"));
});

test("send CALL, receive ERROR(No eligible callee), throw", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cp1 = session.call({
        name: "a"
    });
    await sbs.next();
    server.send([WampType.ERROR, WampType.CALL, cp1.requestId, {}, "wamp.error.no_eligible_callee", ["a"], {a : 1}]);
    await t.throws(cp1.progress().toPromise(), MatchError.illegalOperation("Exclusions", "callee"));
});

test("send CALL, receive ERROR(runtime error), throw", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cp1 = session.call({
        name: "a"
    });
    await sbs.next();
    server.send([WampType.ERROR, WampType.CALL, cp1.requestId, {}, "wamp.error.runtime_error", ["a"], {a : 1}]);
    await t.throws(cp1.progress().toPromise(), err => err instanceof WampusInvocationError && _.isMatch(err.msg, {
        args : ["a"],
        kwargs : {a : 1}
    }));
});

test("send CALL, receive ERROR(custom), throw", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    let cp1 = session.call({
        name: "a"
    });
    await sbs.next();
    server.send([WampType.ERROR, WampType.CALL, cp1.requestId, {}, "custom.error", ["a"], {a : 1}]);
    await t.throws(cp1.progress().toPromise(), err => err instanceof WampusInvocationError && _.isMatch(err.msg, {
        args : ["a"],
        kwargs : {a : 1},
        error : "custom.error"
    }));
});

test.skip("send CALL, session closes in the middle (goodbye)", async t => {

});

test.skip("send CALL, session closes in the middle (abort)", async t => {

});

test.skip("send CALL, session closes in the middle (transport)", async t => {

});