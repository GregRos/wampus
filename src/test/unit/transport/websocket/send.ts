import test from "ava";
import {bufferCount, first, flatMap, take} from "rxjs/operators";
import {fromArray} from "rxjs/internal/observable/fromArray";
import {range} from "lodash";
import {JsonSerializer} from "~lib/core/serializer/json";
import {getTransportAndServerConn} from "~test/helpers/mocks/mocked-ws-transport";

test("just one", async t => {
    let {transport, ws} = await getTransportAndServerConn();
    let o1 = {a: 10};
    await transport.send$(o1).toPromise();
    let obj = await ws.out.next();
    t.deepEqual(obj.data, o1);
});

test("many", async t => {
    let {transport, ws} = await getTransportAndServerConn();
    let sent = range(0, 10).map(i => ({a: i}));
    let sending = fromArray(sent).pipe(flatMap(x => {
        return transport.send$(x);
    })).toPromise();
    await sending;
    let receivedSet = new Set((await ws.out.nextK(10)).map(x => x.data));
    t.deepEqual(receivedSet, new Set(sent));
});
