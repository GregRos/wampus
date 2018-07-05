import {TransportMessage, WampusTransport} from "../transport/transport";
import {
    WampCallOptions,
    WampInvocationOptions,
    WampMessage, WampPublishOptions,
    WampRegisterOptions,
    WampSubscribeOptions
} from "../proto/messages";
import {EventEmitter} from "events";
import pEvent = require("p-event");
import {WampMsgType} from "../proto/message.type";
import most = require("most");
import "../most-ext/events";
export interface WampusSessionConfig {
    realm: string;
    timeout: number;

    transport(): Promise<WebsocketTransport>;
}

import WM = WampMessage;
import {Errs, IllegalOperations, NetworkErrors} from "../errors/errors";

import {MessageRouter} from "../utils/message-router";
import {WampUri} from "../proto/uris";
import {WampMsgHelper} from "../proto/helper";
import {WampusIllegalOperationError, WampusInvocationError, WampusNetworkError} from "../errors/types";
import {DisposableToken, EventArgs, InvocationArgs} from "./call";
import {WebsocketTransport} from "../transport/websocket";

function processAbortDuringHandshake(hello: WM.Hello, msg: WM.Abort) {
    switch (msg.reason) {
        case WampUri.Error.NoSuchRealm:
            throw Errs.Handshake.noSuchRealm(hello.realm);
        case WampUri.Error.ProtoViolation:
            throw Errs.receivedProtocolViolation(hello.type, null);
        default:
            throw Errs.Handshake.unrecognizedError(msg);
    }
}

function processErrorDuringCall(call: WM.Call, msg: WM.Error) {
    switch (msg.error) {
        case WampUri.Error.NoSuchProcedure:
            return Errs.Call.noSuchProcedure(call.procedure);
        case WampUri.Error.NoEligibleCallee:
            return Errs.Call.noEligibleCallee(call.procedure);
        case WampUri.Error.DisallowedDiscloseMe:
            return Errs.Call.optionDisallowedDiscloseMe(call.procedure);
        default:
            return new Error("Implement this case");
    }
}

function processErrorDuringRegister(register: WM.Register, msg: WM.Error) {
    switch (msg.error) {
        case WampUri.Error.ProcAlreadyExists:
            return Errs.Register.procedureAlreadyExists(register.procedure);
        default:
            return Errs.Register.error(register.procedure, msg);

    }
}

function processErrorDuringSubscribe(subscribe : WM.Subscribe, error : WM.Error) {
    return new Error("Failed!");
}

export type WampusInternalSession = Partial<WampusSession> & {
    _config: WampusSessionConfig;
    _transport: WampusTransport;
    _factory: WampMsgHelper;
    _routes: MessageRouter<WM.Any>;
}

export class WampusSession {
    id: number;
    private _config: WampusSessionConfig;
    private _transport: WebsocketTransport;
    private _factory: WampMsgHelper;
    private _routes: MessageRouter<WM.Any>;

    static async create(config: WampusSessionConfig) {
        let session = new WampusSession();
        session._config = config;
        let wm = session._factory = new WampMsgHelper(() => Math.floor(Math.random() * (2 << 50)));
        let transport = await config.transport();
        session._transport = transport;
        await session._handshake();
        session._registerRoutes();
        return session;
    }

    register(options: WampRegisterOptions, name: string, handler : (args : InvocationArgs) => Promise<any>): Promise<DisposableToken> {
        let factory = this._factory;
        let expect = factory.expect;
        let msg = factory.register(options, name);
        let sending = this._transport.send(msg).flatMap(() => most.empty());

        return new Promise<DisposableToken>((resolve, reject) => {
            this._routes.expect(
                expect.registered(msg.requestId),
                expect.error(WampMsgType.Register, msg.requestId)
            ).merge(sending).map(x => {
                if (x instanceof WampMessage.Error) {
                    throw processErrorDuringRegister(msg, x);
                }
                return x as WampMessage.Registered;
            }).tapFull({
                error(x) {
                    reject(x);
                },
                next(registered) {
                    resolve({
                        dispose : () => {
                            let sending = this._transport.send(factory.unregister(registered.registrationId));
                            return this._routes.expect(expect.unregistered(registered.registrationId))
                                .merge(sending)
                                .drain();
                        }
                    });
                }
            }).flatMap(registered => {
                let unregisteredSent = this._routes.expect(expect.unregistered(registered.registrationId));
                return this._routes.expect(expect.invocation(registered.registrationId)).takeUntil(unregisteredSent);
            }).map(x => x as WampMessage.Invocation)
            .flatMap(msg => {
                let args = new InvocationArgs(msg, this as any);
                handler(args);
                return most.empty();
            }).drain();
        })
    }

    publish(options : WampPublishOptions, name : string) {
        let factory = this._factory;
        let expecting = factory.expect;
        return async (args) => {
            let publish = factory.publish(options, name, args);
            let sending = this._transport.send(publish);

        }
    }

    event(options: WampSubscribeOptions, name: string) {
        let factory = this._factory;
        let expecting = factory.expect;
        return most.just(null).flatMap(() => {
            let msg = factory.subscribe(options, name);
            let sending = this._transport.send(msg).flatMap(() => most.empty())
            return this._routes.expect(
                expecting.subscribed(msg.requestId),
                expecting.error(WampMsgType.Subscribe, msg.requestId)
            ).merge(sending).map(x => {
                if (x instanceof WM.Error) {
                    throw processErrorDuringSubscribe(msg, x);
                }
                return x as WM.Subscribed;
            });
        }).flatMap(subscribed => {
            return this._routes.expect(expecting.event(subscribed.subscriptionId)).lastly(async () => {
                return this._routes.expect(expecting.unsubscribed(subscribed.subscriptionId))
                    .merge(this._transport.send(factory.unsubscribe(subscribed.subscriptionId)))
                    .drain()
            });
        }).map((x : WM.Event) => {
            let a = new EventArgs(x);
            return a;
        });
    }

    call(options: WampCallOptions, name: string, args: any[], kwargs: any) {
        let self = this;
        let factory = this._factory;
        let expect = this._factory.expect;
        /*
        TODO: Implement advanced features
        1. Cancellation
        2. Caller disclosure
        3. Filtering
        4. Progress reports
        5. Timeout
        6. Sharded registration (N/A)
         */

        return most.just(null).flatMap(() => {
            let msg = this._factory.call(options, name, args, kwargs);
            let sending = this._transport.send(msg).flatMap(x => most.empty());
            return self._routes.expect(
                expect.result(msg.requestId),
                expect.error(WampMsgType.Call, msg.requestId)
            ).map(x => {
                if (x instanceof WampMessage.Error) {
                    throw processErrorDuringCall(msg, x);
                }
                return x as WampMessage.Result;
            }).take(1).merge(sending);
        });
    }

    async abort(reasonUri: string, details: object) {
        return this._transport.send(this._factory.abort(details, reasonUri));
    }

    private _unregister(registration: number) {

    }

    private async _handshake() {
        let transport = this._transport;
        let config = this._config;
        let hello = this._factory.hello(config.realm, {
            roles : {
                callee : {}
            }
        });
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
        }).merge(transport.send(hello)).toPromise();
        let msg = await welcomeMessage;
        this.id = msg.sessionId;
    }

    private _onError(err) {

    }

    private _onViolation(violation) {

    }

    private _onClose(closingMessage: WM.Abort | WM.Goodbye) {

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
            error: (rr) => {
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