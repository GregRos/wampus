import test from "ava";
import {rewiremock} from "~test/helpers/rewiremock";
import {WebsocketTransport} from "~lib/core/transport/websocket";
import {Transport} from "~lib/core/transport/transport";
import {EMPTY, NEVER, Observable} from "rxjs";
import {MatchError} from "~test/helpers/errors";

const WebsocketTransportToken = {};

const {DependencyDeclarations} = rewiremock.proxy(() => require("~lib/wrappers/dependency-selector") as typeof import("~lib/wrappers/dependency-selector"), d => {
    return {
        "../core/transport/websocket": {
            WebsocketTransport: {
                async create() {
                    return WebsocketTransportToken;
                }
            }
        }
    }
});

test("type = websocket", async t => {
    const ws = await DependencyDeclarations.transport({
        type: "websocket",
        serializer: "json"
    } as any)();
    t.is(ws, WebsocketTransportToken);
});

test("function - returns itself", async t => {
    const custom = {
        name: "blah",
        async close(extra?: object): Promise<void> {

        },
        events$: null,
        isActive: true,
        send$(msg: object): Observable<any> {
            return NEVER;
        }
    } as Transport;
    const result = DependencyDeclarations.transport(() => custom)();
    t.is(result, custom);
});

test("type = unknown throws", async t => {
    const err = t.throws(() => DependencyDeclarations.transport({
        type: "blah"
    } as any));

    t.true(MatchError.invalidArgument(err, "unknown transport", "blah"));
});

test("unknown object throws", async t => {
    const err = t.throws(() => DependencyDeclarations.transport({} as any));
    t.true(MatchError.invalidArgument(err, "invalid transport"));
});

test("null throws", async t => {
    const err = t.throws(() => DependencyDeclarations.transport(null));
    t.assert(MatchError.invalidArgument(err, "invalid transport"));
});