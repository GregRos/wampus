import {dummyTransport} from "./dummy-transport";
import {Session} from "../../lib/core/session";
import {first, take, toArray} from "rxjs/operators";
import {Observable} from "rxjs";

export function createSession(realm: string) {
    let {client, server} = dummyTransport();
    let session = Session.create({
        realm: realm,
        timeout: 1000,
        transport: client
    });
    return {
        session,
        server
    };
}

export async function postHandshake() {
    let {server, session} = createSession("a");
    let hello = await server.messages.pipe(first()).toPromise();
    let wDetails = {
        roles: {
            broker: {},
            dealer: {}
        }
    };
    server.send([2, 123, wDetails]);
    return {
        server,
        session: await session
    };
}


export function stepByStep<T>(what : Observable<T>) {
    let list = [];
    what.subscribe({
        next(x) {
            list.push(x);
        }
    });
    return {
        async next() {
            if (list.length === 0) {
                let r= await what.pipe(take(1)).toPromise();
                list.splice(0, 1);
                return r;
            } else {
                let r = list[0];
                list.splice(0, 1);
                return r;
            }
        },
        async nextK(count = 1) {
            let part = list.slice(0, count);
            if (part.length === count) return part;
            let rest = await what.pipe(take(count - part.length), toArray()).toPromise();
            part.push(...rest);
            return part;
        }
    }
}