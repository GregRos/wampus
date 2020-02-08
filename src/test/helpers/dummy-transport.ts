import {Transport, TransportEvent} from "../../lib/core/transport/transport";
import {concat, defer, EMPTY, Observable, Subject, timer} from "rxjs";
import {WampArray, Wamp, WampRaw} from "typed-wamp";
import {choose} from "../../lib/utils/rxjs-operators";

import {map, mergeMapTo} from "rxjs/operators";
import {WampusNetworkError} from "../../lib/core/errors/types";
import {ObservableMonitor, Rxjs} from "./observable-monitor";

/**
 * A mock server used to implement the mock transport.
 */
export interface DummyServer {
    readonly events: Observable<TransportEvent>;
    readonly messages: Observable<WampRaw.Any>;

    error(x: WampusNetworkError): void;

    send(x: WampRaw.Unknown): void;

    close(): void;
}

/**
 * Returns a mock transport object that gives access to the messages that go through it.
 */
export function dummyTransport() {
    let intoClient = new Subject<TransportEvent>();
    let intoServer = new Subject<TransportEvent>();
    let isActive = true;

    function done() {
        isActive = false;
    }


    // tslint:disable:no-floating-promises
    let server: DummyServer = {
        error(x) {
            Promise.resolve().then(() => {
                intoClient.next({
                    type: "error",
                    data: x
                });
            });
        },
        send(x) {
            Promise.resolve().then(() => {
                intoClient.next({
                    type: "message",
                    data: x
                });
            });
        },
        close() {
            Promise.resolve().then(() => {
                intoClient.next({
                    type: "closed",
                    data: {}
                });
                done();
            });
        },
        events: intoServer,
        messages: intoServer.pipe(choose(x => x.type === "message" ? x.data as WampRaw.Any : undefined))
    };
    return {
        client: {
            name: "dummy",
            async close() {
                intoServer.next({
                    type: "closed",
                    data: {}
                });
                done();
            },
            events$: intoClient,
            send$(x) {
                return concat(timer(Math.random() * 20), defer(() => {
                    intoServer.next({
                        type: "message",
                        data: x as any[]
                    });
                    return EMPTY;
                })).pipe(mergeMapTo(EMPTY));
            },
            get isActive() {
                return isActive;
            }
        } as Transport,
        server
    };
}