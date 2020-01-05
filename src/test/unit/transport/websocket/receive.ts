import test from "ava";
import {getTransportAndServerConn, sendVia} from "../../../helpers/ws-server";
import {bufferCount, filter, flatMap, map, take} from "rxjs/operators";
import {fromArray} from "rxjs/internal/observable/fromArray";
import {range} from "lodash";

test("just one", async t => {
    let {server, client} = await getTransportAndServerConn();
    let o = {
        a: 5
    };
    let receive = client.events$.pipe(filter(x => x.type === "message"), take(1)).toPromise();
    await sendVia(server, o);
    let ro = await receive;
    t.deepEqual(ro.data, o);
});

test("many", async t => {
    let {server, client} = await getTransportAndServerConn();
    let sent = range(0, 10).map(i => ({a: i}));

    let receive10 = client.events$.pipe(
        filter(x => x.type === "message"),
        take(10),
        map(x => x.data),
        bufferCount(10)
    ).toPromise();
    let sending = fromArray(sent).pipe(flatMap(x => {
        return sendVia(server, x);
    })).toPromise();
    await sending;
    let all = await receive10;
    t.deepEqual(new Set(all), new Set(sent));
});