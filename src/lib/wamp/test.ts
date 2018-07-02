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
import {ExpectationStore} from "../utils/expectation-store";

export interface WampusSessionStuff {
    on(event : "message", handler : (arg : WM.Any) => void);
}

export class WampusSession extends EventEmitter implements WampusSessionStuff{
    private _config : WampusSessionConfig;
    id : number;
    private _transport : WampusTransport;
    private _factory : WampMessageFactory;
    private _expectations : ExpectationStore;
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
                );
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
        this.id = msg.sessionId;
    }

    private _onError(err) {

    }

    private _registerExpectationSystem() {
        this._expectations = new ExpectationStore(x => this._factory.read(x));
        this._transport.events.subscribe({
            next : x => {
                if (!this._expectations.resolve(x.data)) {
                    this._onError(new WampusNetworkError("Received unexpected message.", {
                        type : x[0],
                        arg1 : x[1]
                    }))
                }
            },
            complete : () => {
                this._expectations.close();
            },
            error : () => {
                this._expectations.close();
                throw new Error("Unexpected!");
            }
        })
    }

    static async create(config : WampusSessionConfig) {
        let session = new WampusSession();
        let wm = session._factory = new WampMessageFactory(() => Math.floor(Math.random() * (2 << 50)));
        let transport = await config.transport();
        session._transport = transport;
        await session._handshake();
        session._registerExpectationSystem();
        return session;
    }

    private _expectReply(type : WampMsgType, requestId : number) {
        return new Promise((resolve, reject) => {
            this._expectations.addExpectation(type, requestId, x => {
                return true;
            });
        })
    }

    async call(name : string, args : any[], kwargs : any) {

    }
}