import {Transport, TransportEvent} from "../../lib/core/messaging/transport/transport";
import {defer, EMPTY, Observable, Subject} from "rxjs";
import {WampObject} from "../../lib/protocol/messages";
import {choose} from "../../lib/utils/rxjs";

export function dummyTransport() {
    let intoClient = new Subject<TransportEvent>();
    let intoServer = new Subject<TransportEvent>();
    return {
        client: {
            async close() {
                intoServer.next({
                    type : "closed",
                    data : {}
                });
            },
            events: intoClient,
            send$(x) {
                return defer(() => {
                    intoServer.next({
                        type : "message",
                        data : x
                    });
                    return EMPTY;
                });
            }
        } as Transport,
        server: {
            error(x) {
                intoClient.next({
                    type : "error",
                    data : x
                })
            },
            send(x) {
                intoClient.next({
                    type : "message",
                    data : x
                });
            },
            close() {
                intoClient.next({
                    type : "closed",
                    data : {}
                })
            },
            events: intoServer,
            messages : intoServer.pipe(choose(x => x.type === "message" ? x.data : undefined))
        }
    }
}