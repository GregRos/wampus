import {TransportMessage, WampusTransport} from "../transport/transport";
import {WampCallOptions, WampMessage, WampMessageFactory} from "../proto/messages";
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
import {IllegalOperations, WampusInvocationError, WampusNetworkError} from "../errors/errors";
import {Stream} from "most";
import {MessageRouter} from "../utils/message-router";
import {Subject} from "../must-ext/events";
import {WampUri} from "../proto/uris";


export class WampusSession {
    private _config : WampusSessionConfig;
    id : number;
    private _transport : WampusTransport;
    private _factory : WampMessageFactory;
    private _routes : MessageRouter<WM.Any>;
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
            } else {
                let msg = this._factory.read(x.data);

                if (msg instanceof WM.Error) {
                    switch (msg.error) {
                        case WampUri.Error.NoSuchRealm:
                            throw IllegalOperations.noSuchRealm(config.realm);
                            case WampUri.Error.
                    }
                }
                if (!(msg instanceof WM.Welcome)) {
                    throw new WampusNetworkError(
                        "Sent HELLO and received an unexpected message.", {
                            message: x.data
                        }
                    );
                }
                return msg;
            }
        }).toPromise();
        await transport.send(this._factory.hello(config.realm, {}));
        let msg = await welcomeMessage;
        this.id = msg.sessionId;
    }

    private _onError(err) {

    }

    private _registerRoutes() {
        this._routes = new MessageRouter<any>();
        this._transport.events.choose(x => x.type === "message" ? x as TransportMessage: undefined).subscribe({
            next : x => {
                let msg = this._factory.read(x.data);
                if (!this._routes.match(x.data.slice(0, 2), msg)) {
                    this._onError(new WampusNetworkError("Received unexpected message.", {
                        msg : msg
                    }));
                }
            },
            complete : () => {
               this._routes.reset();
            },
            error : () => {
                this._routes.reset();
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
        session._registerRoutes();
        return session;
    }

    call(name : string, args : any[], kwargs : any, options ?: WampCallOptions) {
        return new most.Stream({
            run(sink, sch) {
                let msg = this._factory.call(options || {}, name, args, kwargs);
                let cancel = Subject.create();
                let sub = this._routes.expectFirst([WampMsgType.Result, msg.requestId], [WampMsgType.Error, WampMsgType.Call, msg.requestId]).subscribe({
                    next(x : WM.Any) {
                        if (x instanceof WM.Error) {
                            const errorUri = WampUri.Error;
                            switch (x.error) {
                                case errorUri.
                            }
                            sink.error(sch.now(), new WampusInvocationError())
                        }
                    }
                });
                return {
                    dispose() {

                    }
                }
            }
        })




    }





}