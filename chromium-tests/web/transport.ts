import {WebsocketTransport} from "~lib/core/transport/websocket";
import {JsonSerializer} from "~lib/core/serializer/json";
import {assert} from "chai";
import {wampServerUrl} from "../shared";

describe("WebSocket transport", () => {
    let conn: WebsocketTransport;
    it("establishes connection", async () => {
        conn = await WebsocketTransport.create({
            url: wampServerUrl,
            serializer: new JsonSerializer()
        });

        assert.isTrue(conn.isActive);
        assert.equal(conn.location, wampServerUrl);
        assert.equal(conn.name, "websocket.json");
    });
});

