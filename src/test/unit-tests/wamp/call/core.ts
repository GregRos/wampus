import test, {GenericTestContext} from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {WampType} from "../../../../lib/core/protocol/message.type";
import _ = require("lodash");
import {choose} from "../../../../lib/utils/rxjs-operators";
import {WampCallOptions} from "../../../../lib/core/protocol/options";
import {map, share, shareReplay, take, toArray} from "rxjs/operators";
import {CallTicket} from "../../../../lib/core/session/ticket";
import {Observable} from "rxjs";
import {WampResult} from "../../../../lib/core/basics";
import {Rxjs} from "../../../helpers/observable-monitor";
import {MatchError} from "../../../helpers/errors";
import {WampusIllegalOperationError, WampusInvocationError} from "../../../../lib/core/errors/types";

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
        1 : cr.info.callId,
        2: {},
        3: "a",
        4 : [1],
        5 : {a : 5}
    }));
    t.falsy(await sbs.nextWithin(10), "an exact message was sent?");
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
    server.send([WampType.RESULT, cp.info.callId, {}, ["a"], {a : 5}]);
    let allProgress = await cp.progress.pipe(toArray()).toPromise();
    t.true(_.isMatch(allProgress, [{
        isProgress : false,
        kwargs : {a : 5},
        args : ["a"],
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
    let pr1 = cp1.progress.pipe(map(x => x.kwargs), toArray()).toPromise();
    let pr2 = cp2.progress.pipe(map(x => x.kwargs), toArray()).toPromise();
    server.send([WampType.RESULT, cp1.info.callId, {}, null, {a : 1}]);
    server.send([WampType.RESULT, cp2.info.callId, {}, null, {a : 2}]);


    t.deepEqual(await pr1, [{a: 1}]);
    t.deepEqual(await pr2, [{a: 2}]);
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
    let pr1 = cp1.progress.pipe(map(x => x.kwargs), toArray()).toPromise();
    let pr2 = cp2.progress.pipe(map(x => x.kwargs), toArray()).toPromise();
    server.send([WampType.RESULT, cp1.info.callId, {}, null, {a : 1}]);
    server.send([WampType.RESULT, cp2.info.callId, {}, null, {a : 2}]);

    t.deepEqual(await pr1, [{a : 1}]);
    t.deepEqual(await pr2, [{a : 2}]);
});

function sendCallReceiveErrorMacro(o : {title : string, errId : string, errMatch : (x : any) => boolean}) {
    test(o.title, async (t : GenericTestContext<any>) => {
        let {server, session} = await SessionStages.handshaken("a");
        let sbs = Rxjs.monitor(server.messages);
        let cp1 = session.call({
            name: "a"
        });
        await sbs.next();
        server.send([WampType.ERROR, WampType.CALL, cp1.info.callId, {}, o.errId, ["a"], {a : 1}]);
        await t.throws(cp1.progress.toPromise(), o.errMatch);
    });
}
sendCallReceiveErrorMacro({
    errMatch : MatchError.illegalOperation("Procedure", "exist"),
    errId : "wamp.error.no_such_procedure",
    title : "send CALL, receive ERROR(procedure doesn't exist), throw"
});

sendCallReceiveErrorMacro({
    errMatch : MatchError.illegalOperation("options was not allowed"),
    errId : "wamp.error.option_not_allowed",
    title : "send CALL, receive ERROR(Option not allowed), throw"
});

sendCallReceiveErrorMacro({
    errMatch : MatchError.illegalOperation("Exclusions", "callee"),
    errId : "wamp.error.no_eligible_callee",
    title : "send CALL, receive ERROR(No eligible callee), throw"
});

sendCallReceiveErrorMacro({
    errMatch : MatchError.illegalOperation("Argument"),
    errId : "wamp.error.invalid_argument",
    title : "send CALL, receive ERROR(Invalid argument), throw"
});

sendCallReceiveErrorMacro({
    errMatch : MatchError.illegalOperation("disclose_me"),
    errId : "wamp.error.option_disallowed.disclose_me",
    title : "send CALL, receive ERROR(option disallowed - disclose me), throw"
});

sendCallReceiveErrorMacro({
    errMatch : MatchError.illegalOperation("not authorized"),
    errId : "wamp.error.not_authorized",
    title : "send CALL, receive ERROR(not authorized), throw"
});

sendCallReceiveErrorMacro({
    errMatch : err => err instanceof WampusInvocationError && _.isMatch(err, {
        args : ["a"],
        kwargs : {a : 1}
    }),
    errId : "wamp.error.runtime_error",
    title : "send CALL, receive ERROR(runtime error), throw"
});

sendCallReceiveErrorMacro({
    errMatch : err => err instanceof WampusInvocationError && _.isMatch(err, {
        args : ["a"],
        kwargs : {a : 1},
        error : "custom.error"
    }),
    errId : "custom.error",
    title : "send CALL, receive ERROR(custom), throw"
});


test("call() on closed session", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);
    server.send([3, {}, "no"]);
    await session.close();
    let cp1 = session.call({
        name: "a"
    });
    await t.throws(cp1.progress.toPromise(), MatchError.network("session", "clos"));
});

test("close connection before result received", async t => {
    let {server, session} = await SessionStages.handshaken("a");
    let sbs = Rxjs.monitor(server.messages);

    let cp1 = session.call({
        name: "a"
    });
    let finished =  cp1.progress.toPromise();
    finished = t.throws(finished, MatchError.network("session", "clos"));
    server.send([3, {}, "no"]);

    await session.close();
    await finished;
})

