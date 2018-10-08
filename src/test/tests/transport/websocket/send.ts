import test from "ava";
import {getTransportAndServerConn, receiveObjects$} from "../../../helpers/ws-server";
import {bufferCount, first, flatMap, take} from "rxjs/operators";
import {range} from "rxjs";
import _ = require("lodash");
import {fromArray} from "rxjs/internal/observable/fromArray";
test("just one", async t => {
    let {servConn,clientConn} = await getTransportAndServerConn();
    let rec$ = receiveObjects$(servConn).pipe(first());
    let o1 = {a : 10};
    await clientConn.send$(o1).toPromise();
    let obj = await rec$.toPromise();
    t.deepEqual(obj, o1);
});

test("many", async t => {
    let {servConn,clientConn} = await getTransportAndServerConn();
    let receive10 = receiveObjects$(servConn).pipe(take(10)).pipe(bufferCount(10)).toPromise();
    let sent = _.range(0, 10).map(i => ({a : i}));
    let sending = fromArray(sent).pipe(flatMap(x => {
        return clientConn.send$(x);
    })).toPromise();
    await sending;
    let receivedSet = new Set(await receive10);
    t.deepEqual(receivedSet, new Set(sent));
});