import {Transport, TransportEvent} from "../../lib/core/messaging/transport/transport";
import {defer, EMPTY, Observable, Subject} from "rxjs";
import {WampObject} from "../../lib/protocol/messages";
import {choose} from "../../lib/utils/rxjs";
import {MyPromise} from "../../lib/ext-promise";

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
                MyPromise.soon(() => {
                    intoClient.next({
                        type : "error",
                        data : x
                    })
                })
            },
            send(x) {
                MyPromise.soon(() => {
                    intoClient.next({
                        type : "message",
                        data : x
                    });
                });
            },
            close() {
                MyPromise.soon(() => {
                    intoClient.next({
                        type : "closed",
                        data : {}
                    })
                })
            },
            events: intoServer,
            messages : intoServer.pipe(choose(x => x.type === "message" ? x.data : undefined))
        }
    }
}