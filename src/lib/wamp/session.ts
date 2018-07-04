import {TransportMessage, WampusTransport} from "../transport/transport";
import {WampCallOptions, WampMessage} from "../proto/messages";
import {EventEmitter} from "events";
import pEvent = require("p-event");
import {WampMsgType} from "../proto/message.type";
import most = require("most");

export interface WampusSessionConfig {
    realm: string;
    timeout: number;

    transport(): Promise<WampusTransport>;
}

import WM = WampMessage;
import {Errs, IllegalOperations, NetworkErrors} from "../errors/errors";
import {Stream, Subscriber} from "most";
import {MessageRouter} from "../utils/message-router";
import {Subject} from "../most-ext/events";
import {WampUri} from "../proto/uris";
import {WampMessageFactory} from "../proto/factory";
import {WampusInvocationError, WampusNetworkError} from "../errors/types";

function processAbortDuringHandshake(hello: WM.Hello, msg: WM.Abort) {
    switch (msg.reason) {
        case WampUri.Error.NoSuchRealm:
            throw Errs.Handshake.noSuchRealm(hello.realm);
        case WampUri.Error.ProtoViolation:
            throw Errs.receivedProtocolViolation(hello.type, msg);
        default:
            throw Errs.Handshake.unrecognizedError(msg);
    }
}

function processErrorDuringCall(call: WM.Call, msg: WM.Error) {
    switch (msg.error) {
        case WampUri.Error.NoSuchProcedure:
            throw Errs.Call.noSuchProcedure(call.procedure);
        case WampUri.Error.NoEligibleCallee:
            throw Errs.Call.noEligibleCallee(call.procedure);
        case WampUri.Error.DisallowedDiscloseMe:
            throw Errs.Call.optionDisallowedDiscloseMe(call.procedure);
        default:
            throw new Error("Implement this case");
    }
}

export class WampusSession {
    id: number;
    private _config: WampusSessionConfig;
    private _transport: WampusTransport;
    private _factory: WampMessageFactory;
    private _routes: MessageRouter<WM.Any>;

    static async create(config: WampusSessionConfig) {
        let session = new WampusSession();
        let wm = session._factory = new WampMessageFactory(() => Math.floor(Math.random() * (2 << 50)));
        let transport = await config.transport();
        session._transport = transport;
        await session._handshake();
        session._registerRoutes();
        return session;
    }

    call(options: WampCallOptions, name: string, args: any[], kwargs: any) {
        let self = this;

        /*
        TODO: Implement advanced features
        1. Cancellation
        2. Caller disclosure
        3. Filtering
        4. Progress reports
        5. Timeout
        6. Sharded registration (N/A)
         */

        return new most.Stream({
            run: (sink, sch) => {
                let msg = this._factory.call(options || {}, name, args, kwargs);
                let waits =
                    self._routes.expect([WampMsgType.Result, msg.requestId], [WampMsgType.Error, WampMsgType.Call, msg.requestId]).map(x => {
                        if (x instanceof WampMessage.Error) {
                            processErrorDuringCall(msg, x);
                        } else if (x instanceof WampMessage.Result) {
                            return x.args;
                        }
                    }).take(1).source.run(sink, sch);
                let callMsg = this._factory.call(options, name, args, kwargs);
                this._transport.send(callMsg).catch(err => {
                    sink.error(sch.now(), err);
                });
                return {
                    dispose: async () => {
                        // Implement cancellation here
                        await waits.dispose();
                        return {};
                    }
                }
            }
        });
    }

    async abort(reasonUri: string, details: object) {
        return this._transport.send(this._factory.abort(details, reasonUri));
    }

    private async _handshake() {
        let transport = this._transport;
        let config = this._config;
        let hello = this._factory.hello(config.realm, {});
        let welcomeMessage = transport.events.take(1).map(x => {
            if (x.type === "error") {
                throw x.data;
            } else if (x.type === "closed") {
                throw Errs.Handshake.closed();
            } else {
                let msg = this._factory.read(x.data);
                if (msg instanceof WM.Abort) {
                    processAbortDuringHandshake(hello, msg);
                }
                if (msg instanceof WM.Challenge) {
                    throw Errs.featureNotSupported(msg, "CHALLENGE authentication");
                }
                if (!(msg instanceof WM.Welcome)) {
                    throw Errs.Handshake.unexpectedMessage(msg);
                }
                return msg;
            }
        }).toPromise();
        await transport.send(hello);
        let msg = await welcomeMessage;
        this.id = msg.sessionId;
    }

    private _onError(err) {

    }

    private _onViolation(violation) {

    }

    private _onClose(closingMessage : WM.Abort | WM.Goodbye) {

    }

    private _registerRoutes() {
        this._routes = new MessageRouter<any>();
        this._transport.events.choose(x => x.type === "message" ? x as TransportMessage : undefined).subscribe({
            next: x => {
                let msg = this._factory.read(x.data);
                if (!this._routes.match(x.data.slice(0, 2), msg)) {
                    this._onError(Errs.unexpectedMessage(msg));
                }
            },
            complete: () => {
                this._routes.reset();
            },
            error: () => {
                this._routes.reset();
                throw new Error("Unexpected!");
            }
        });

        let serverAborted = this._routes.expect([WampMsgType.Abort]);
        let serverSentInvalidMessage = this._routes.expect(
            [WampMsgType.Welcome],
            [WampMsgType.Challenge]
        );
        let serverSentRouterMessage = this._routes.expect(
            [WampMsgType.Authenticate],
            [WampMsgType.Yield],
            [WampMsgType.Hello],
            [WampMsgType.Register],
            [WampMsgType.Call],
            [WampMsgType.Publish],
            [WampMsgType.Unregister],
            [WampMsgType.Subscribe],
            [WampMsgType.Unsubscribe],
            [WampMsgType.Cancel]
        );
    }


}