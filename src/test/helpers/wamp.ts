import {dummyTransport} from "./dummy-transport";
import {WampusCoreSession} from "../../lib/core/session/core-session";
import {first} from "rxjs/operators";
import {BrokerFeatures, DealerFeatures} from "../../lib/core/protocol/options";


export module SessionStages {
    export function fresh(realm: string) {
        let {client, server} = dummyTransport();
        let session = WampusCoreSession.create({
            realm: realm,
            timeout: 1000,
            transport: client
        });
        return {
            session,
            server
        };
    }

    export async function handshaken(realm : string, feats ?: {dealer ?: Partial<DealerFeatures>, broker ?: Partial<BrokerFeatures>}) {
        let {server, session} = fresh(realm);
        let hello = await server.messages.pipe(first()).toPromise();
        feats = feats || {};
        let wDetails = {
            roles : {
                broker : {
                    features : feats.broker || {}
                },
                dealer : {
                    features : feats.dealer || {}
                }
            }
        };
        server.send([2, 123, wDetails]);
        return {
            server,
            session: await session
        };
    }
}

