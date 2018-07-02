import {WampusTransport} from "../transport/transport";
import {WampMessage, WampMessageFactory} from "../proto/messages";
import {EventEmitter} from "events";
import pEvent = require("p-event");
import {WampMsgType} from "../proto/message.type";
import most = require("most");

export interface WampusSessionConfig {
    realm : string;
    transport() : Promise<WampusTransport>;
    timeout : number;
}

import WM = WampMessage;
import {WampusNetworkError} from "../errors/errors";
import {Stream} from "most";

export interface WampusSessionStuff {
    on(event : "message", handler : (arg : WM.Any) => void);
}

export class WampusSession implements WampusSessionStuff{
    private _config : WampusSessionConfig;
    id : number;
    private _transport : WampusTransport;
    private _factory : WampMessageFactory;
    private _messages : Stream<WampMessage.Any>;

    private async _handshake() {
        let transport = this._transport;
        let config = this._config;
        let welcomeMessage = transport.events.take(1).map(x => {
            if (x.type === "error") {
                throw new WampusNetworkError(
                    "Error during handshake.", {
                        err : x.data
                    }
                );
            } else if (x.type === "closed") {
                throw new WampusNetworkError(
                    "Transport closed during handshake.", {
                        reason : x.type
                    }
                )
            } else if (!(x.data instanceof WM.Welcome)) {
                throw new WampusNetworkError(
                    "Sent HELLO and received an unexpected message.", {
                        message : x.data
                    }
                );
            } else {
                return x.data;
            }
        }).toPromise();
        await transport.send(this._factory.hello(config.realm, {}));
        let msg = await welcomeMessage;
        
    }

    static async create(config : WampusSessionConfig) {
        let session = new WampusSession();
        let wm = session._factory = new WampMessageFactory(() => Math.floor(Math.random() * (2 << 50)));
        let transport = await config.transport();
        session._transport = transport;
        let waitWelcome = transport.events.take(1).toPromise().then(x => x.type === "message" ? x.data : null);
        await transport.send(wm.hello(config.realm, {}));
        let welcome = await waitWelcome;
        if (welcome.)
    }
}