import test from "ava";
import {getTransportAndServerConn, receiveObjects$} from "../../../helpers/ws-server";
import {bufferCount, first, flatMap, take} from "rxjs/operators";
import {fromArray} from "rxjs/internal/observable/fromArray";
import {range} from "lodash";

test("just one", async t => {
    let {server, client} = await getTransportAndServerConn();
    let rec$ = receiveObjects$(server).pipe(first());
    let o1 = {a: 10};
    await client.send$(o1).toPromise();
    let obj = await rec$.toPromise();
    t.deepEqual(obj, o1);
});

test("many", async t => {
    let {server, client} = await getTransportAndServerConn();
    let receive10 = receiveObjects$(server).pipe(take(10)).pipe(bufferCount(10)).toPromise();
    let sent = range(0, 10).map(i => ({a: i}));
    let sending = fromArray(sent).pipe(flatMap(x => {
        return client.send$(x);
    })).toPromise();
    await sending;
    let receivedSet = new Set(await receive10);
    t.deepEqual(receivedSet, new Set(sent));
});