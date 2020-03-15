import {WebsocketTransport} from "../lib/core/transport/websocket";
import {JsonSerializer} from "../lib/core/serializer/json";
import {assert} from "chai";

describe("WebSocket transport", () => {
    let conn: WebsocketTransport;
    after(async () => {
        if (conn) conn.close();
    });
    it("establishes connection", async () => {

        conn = await WebsocketTransport.create({
            url: "ws://localhost:8080",
            serializer: new JsonSerializer()
        });

        assert.isTrue(conn.isActive);
        assert.equal(conn.location, "ws://localhost:8080");
        assert.equal(conn.name, "websocket.json");
    });
});

