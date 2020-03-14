import {WampusSession} from "~lib/wrappers/wampus-session";
import {Wampus} from "~lib/wrappers/wampus";
import {assert} from "chai";
import {wampServerUrl} from "../shared";
import {first} from "rxjs/operators";

async function getWampus(realm: string) {
    return await Wampus.connect({
        realm,
        transport: {
            type: "websocket",
            serializer: "json",
            url: wampServerUrl
        }
    });
}

describe("Wampus actions", () => {
    let session1: WampusSession;
    let session2: WampusSession;
    after(async () => {
        if (session1) {
            await session1.close();
        }
        if (session2) {
            await session2.close();
        }
    });
    const realm = "wampus-actions-test";
    it("connects", async () => {
        session1 = await getWampus(realm);
        assert.isTrue(session1.isActive);
        assert.equal(session1.protocol.transport.location, wampServerUrl);
        assert.equal(session1.realm, realm);
        session2 = await getWampus(realm);
    });

    it("register procedure", async () => {
        const ticket = await session1.procedure({
            name: "test",
            async called(x) {
                return {
                    args: ["result"]
                };
            }
        });
        assert.isTrue(ticket.isOpen);
    });

    it("call procedure", async () => {
        const callTicket = await session2.call({
            name: "test"
        });
        assert.isNumber(callTicket.id);
        assert.deepEqual(callTicket.args, ["result"]);
    });

    it("publish to topic", async () => {
        await session1.publish({
            name: "test",
            args: ["result"]
        });
    });

    it("subscribe to topic", async () => {
        const topicTicket = await session2.topic({
            name: "test"
        });
        const pFirstEvent = topicTicket.events.pipe(first()).toPromise();
        await session1.publish({
            name: "test",
            args: ["result2"]
        });
        const firstEvent = await pFirstEvent;
        assert.deepEqual(firstEvent.args, ["result2"]);
    });

    it("close connection", async () => {
        await session1.close();
        await session2.close();
    });
});