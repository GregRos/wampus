import test from "ava";
import {getTransportAndServerConn, receiveObjects$} from "~test/helpers/ws-server";
import {bufferCount, first, flatMap, take} from "rxjs/operators";
import {fromArray} from "rxjs/internal/observable/fromArray";
import {range} from "lodash";

test("just one", async t => {
    let {transport, ws} = await getTransportAndServerConn();
    let rec$ = ws.out.next$();
    let o1 = {a: 10};
    await transport.send$(o1).toPromise();
    let obj = await rec$.toPromise();
    t.deepEqual(obj.data, o1);
});

test("many", async t => {
    let {transport, ws} = await getTransportAndServerConn();
    let receive10 = ws.out.nextK(10);
    let sent = range(0, 10).map(i => ({a: i}));
    let sending = fromArray(sent).pipe(flatMap(x => {
        return transport.send$(x);
    })).toPromise();
    await sending;
    let receivedSet = new Set((await receive10).map(x => x.data));
    t.deepEqual(receivedSet, new Set(sent));
});