import {TransportMessage, Transport} from "./transport/transport";
import {
    WampMessage} from "./wamp/messages";
import {EventEmitter} from "events";
import {WampType} from "./wamp/message.type";
import most = require("most");
import "../most-ext/events";
export interface SessionConfig {
    realm: string;
    timeout: number;

    transport(): Promise<WebsocketTransport>;
}

import WM = WampMessage;
import {Errs, IllegalOperations, NetworkErrors} from "../errors/errors";

import {MessageRouter} from "../low/routing/message-router";
import {WampUri} from "./wamp/uris";
import {MessageReader, MessageBuilder} from "./wamp/helper";
import {WampusIllegalOperationError, WampusInvocationError, WampusNetworkError} from "../errors/types";
import {DisposableToken, EventArgs, InvocationArgs} from "./call";
import {WebsocketTransport} from "../low/transport/websocket";
import {Routes} from "../low/routing/routing";
import {
    WampCallOptions,
    WampInvocationOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampSubscribeOptions
} from "./wamp/options";

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


let factory = new MessageBuilder(() => Math.floor(Math.random() * (2 << 50)));
export class InternalSession {
    id: number;
    _config: SessionConfig;
    _transport: WebsocketTransport;
    _factory: MessageBuilder;
    _router: MessageRouter<WM.Any>;

    static async create(config: SessionConfig) {
        let session = new InternalSession();
        session._config = config;
        let wm = session._factory = new MessageBuilder(() => Math.floor(Math.random() * (2 << 50)));
        let transport = await config.transport();
        session._transport = transport;
        await session._handshake();
        session._registerRoutes();
        return session;
    }

    register(options: WampRegisterOptions, name: string, handler : (args : InvocationArgs) => Promise<any>): Promise<DisposableToken> {
        let factory = this._factory;
        let msg = factory.register(options, name);
        let sending = this._transport.send(msg).flatMap(() => most.empty());

        return new Promise<DisposableToken>((resolve, reject) => {
            this._router.expect(
                Routes.registered(msg.requestId),
                Routes.error(WampType.REGISTER, msg.requestId)
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
                            return this._router.expect(Routes.unregistered(registered.registrationId))
                                .merge(sending)
                                .drain();
                        }
                    });
                }
            }).flatMap(registered => {
                let unregisteredSent = this._router.expect(Routes.unregistered(registered.registrationId));
                return this._router.expect(Routes.invocation(registered.registrationId)).takeUntil(unregisteredSent);
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
        return async (args) => {
            let publish = factory.publish(options, name, args);
            let sending = this._transport.send(publish);

        }
    }

    event(options: WampSubscribeOptions, name: string) {
        let factory = this._factory;
        return most.just(null).flatMap(() => {
            let msg = factory.subscribe(options, name);
            let sending = this._transport.send(msg).flatMap(() => most.empty())
            return this._router.expect(
                Routes.subscribed(msg.requestId),
                Routes.error(WampType.SUBSCRIBE, msg.requestId)
            ).merge(sending).map(x => {
                if (x instanceof WM.Error) {
                    throw processErrorDuringSubscribe(msg, x);
                }
                return x as WM.Subscribed;
            });
        }).flatMap(subscribed => {
            return this._router.expect(Routes.event(subscribed.subscriptionId)).lastly(async () => {
                return this._router.expect(Routes.unsubscribed(subscribed.subscriptionId))
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
            let msg = factory.call(options, name, args, kwargs);
            let sending = this._transport.send(msg).flatMap(x => most.empty());
            return self._router.expect(
                Routes.result(msg.requestId),
                Routes.error(WampType.CALL, msg.requestId)
            ).map(x => {
                if (x instanceof WampMessage.Error) {
                    throw processErrorDuringCall(msg, x);
                }
                return x as WampMessage.Result;
            }).take(1).merge(sending);
        });
    }

    async abort(reasonUri: string, details: object) {
        return this._transport.send(factory.abort(details, reasonUri));
    }

    private async _handshake() {
        let transport = this._transport;
        let config = this._config;
        let hello = factory.hello(config.realm, {
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
                let msg = MessageReader.read(x.data);
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
        this._router = new MessageRouter<any>();
        this._transport.events.choose(x => x.type === "message" ? x as TransportMessage : undefined).subscribe({
            next: x => {
                let msg = MessageReader.read(x.data);
                if (!this._router.push(x.data.slice(0, 2), msg)) {
                    this._onError(Errs.unexpectedMessage(msg));
                }
            },
            complete: () => {
                this._router.reset();
            },
            error: (rr) => {
                this._router.reset();
                throw new Error("Unexpected!");
            }
        });

        let serverAborted = this._router.expect([WampType.ABORT]).take(1);
        let serverGoodbye = this._router.expect([WampType.GOODBYE]).take(1);
        let serverSentInvalidMessage = this._router.expect(
            [WampType.WELCOME],
            [WampType.CHALLENGE]
        );
        let serverSentRouterMessage = this._router.expect(
            [WampType.AUTHENTICATE],
            [WampType.YIELD],
            [WampType.HELLO],
            [WampType.REGISTER],
            [WampType.CALL],
            [WampType.PUBLISH],
            [WampType.UNREGISTER],
            [WampType.SUBSCRIBE],
            [WampType.UNSUBSCRIBE],
            [WampType.CANCEL]
        );
    }


}