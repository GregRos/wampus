import test from "ava";
import {getTransportAndServerConn} from "~test/helpers/ws-server";
import {bufferCount, filter, flatMap, map, take} from "rxjs/operators";
import {fromArray} from "rxjs/internal/observable/fromArray";
import {range} from "lodash";

test("just one", async t => {
    let {transport, ws} = await getTransportAndServerConn();
    let o = {
        a: 5
    };
    let receive = transport.events$.pipe(filter(x => x.type === "message"), take(1)).toPromise();
    ws.in.next({
        event: "message",
        data: o
    });
    let ro = await receive;
    t.deepEqual(ro.data, o);
});

test("many", async t => {
    let {transport, ws} = await getTransportAndServerConn();
    let sent = range(0, 10).map(i => ({a: i}));

    let receive10 = transport.events$.pipe(
        filter(x => x.type === "message"),
        take(10),
        map(x => x.data),
        bufferCount(10)
    ).toPromise();
    let sending = sent.forEach(x => {
        ws.in.next({
            event: "message",
            data: x
        });
    });
    await sending;
    let all = await receive10;
    t.deepEqual(new Set(all), new Set(sent));
});