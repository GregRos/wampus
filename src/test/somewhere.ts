/**
 test("url malformed", async t => {
    let conn = getTransport("ff44");
    let err = await t.throwsAsync(conn);
    t.assert(err instanceof WampusNetworkError);
});

 test("connection refused", async t => {
    let conn = getTransport("http://localhost:19413");
    let err = await t.throwsAsync(conn);
    t.assert(err instanceof WampusNetworkError);
});

 test("stays open", async t => {
    let {server} = await getTransportAndServerConn();
    await timer(1000).toPromise();
    t.is(server.readyState, WebSocket.OPEN);
});
 */