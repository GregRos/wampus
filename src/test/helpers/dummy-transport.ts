import {Transport, TransportEvent} from "../../lib/core/transport/transport";
import {defer, EMPTY, Observable, Subject} from "rxjs";
import {WampObject} from "../../lib/core/protocol/messages";
import {choose} from "../../lib/utils/rxjs-operators";
import {MyPromise} from "../../lib/utils/ext-promise";
import {domainToASCII} from "url";

export function dummyTransport() {
    let intoClient = new Subject<TransportEvent>();
    let intoServer = new Subject<TransportEvent>();
    let isActive = true;
    function done() {
        isActive = false;
    }
    return {
        client: {
            async close() {
                intoServer.next({
                    type : "closed",
                    data : {}
                });
                done();
            },
            events$: intoClient,
            send$(x) {
                return defer(() => {
                    intoServer.next({
                        type : "message",
                        data : x
                    });
                    return EMPTY;
                });
            },
            get isActive() {
                return isActive;
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
                    });
                    done();
                })
            },
            events: intoServer,
            messages : intoServer.pipe(choose(x => x.type === "message" ? x.data : undefined))
        }
    }
}