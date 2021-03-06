import test from "ava";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {ChallengeEvent, ChallengeResponse} from "~lib/core/session/authentication";
import {monitor} from "~test/helpers/rxjs-monitor";

test("one CHALLENGE during handshake", async t => {
    let handshaker = async (x: ChallengeEvent) => {
        t.deepEqual(x, {
            authMethod: "auth",
            extra: {b: 1}
        } as ChallengeEvent);
        return {
            extra: {
                a: 1
            },
            signature: "abc"
        } as ChallengeResponse;
    };
    let wDetails = {
        roles: {
            broker: {},
            dealer: {}
        }
    };
    let {server, session} = SessionStages.fresh("a", handshaker);
    let srvMonitor = monitor(server.messages);
    await srvMonitor.next();
    server.send([4, "auth", {b: 1}]);
    let authenticate = await srvMonitor.next();
    t.deepEqual(authenticate, [5, "abc", {a: 1}]);
    server.send([2, 123, wDetails]);
    await session;
});

test("no authenticator", async t => {
    let handshaker = null;

    let {server, session} = SessionStages.fresh("a", handshaker);
    let srvMonitor = monitor(server.messages);
    let eventuallySessionThrows = t.throwsAsync(session);
    await srvMonitor.next();
    server.send([4, "auth", {b: 1}]);
    await eventuallySessionThrows;
});

test("two CHALLENGE during handshake", async t => {
    let handshaker = async (x: ChallengeEvent) => {
        return {
            extra: {
                a: x.authMethod
            },
            signature: "abc"
        } as ChallengeResponse;
    };
    let wDetails = {
        roles: {
            broker: {},
            dealer: {}
        }
    };
    let {server, session} = SessionStages.fresh("a", handshaker);
    let srvMonitor = monitor(server.messages);
    await srvMonitor.next();
    server.send([4, "auth", {b: 1}]);
    let authenticate = await srvMonitor.next();
    t.deepEqual(authenticate, [5, "abc", {a: "auth"}]);
    server.send([4, "auth2", {b: 1}]);
    let authenticate2 = await srvMonitor.next();
    t.deepEqual(authenticate2, [5, "abc", {a: "auth2"}]);

    server.send([2, 123, wDetails]);
    await session;
});
