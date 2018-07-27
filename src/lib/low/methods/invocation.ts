import {WampMessage, WampObject} from "../wamp/messages";
import {WampError} from "./shared";
import {WampUri} from "../wamp/uris";
import {Errs} from "../../errors/errors";
import {WampResult} from "./shared";
import {WampInvocationOptions, WampYieldOptions} from "../wamp/options";
import {Stream} from "most";
import {Subject} from "../../most-ext/subject";
import {MessageBuilder} from "../wamp/helper";
import {WampType} from "../wamp/message.type";
import {MyPromise} from "../../ext-promise";
import most = require("most");
import {WampusInvocationCanceledError} from "../../errors/types";
export interface InvocationArgsCallbacks {
    factory : MessageBuilder;
    send$(msg : WampMessage.Any) : Stream<void>;
    expectInterrupt$ : Stream<WampMessage.Interrupt>;
}

export interface InvocationArgs {

}

export class InvocationRequest implements WampResult{
    isHandled = false;

    get args() {
        return this._msg.args;
    }

    get kwargs() {
        return this._msg.kwargs;
    }

    get options(): WampInvocationOptions {
        return this._msg.options;
    }

    get name() {
        return this._name;
    }

    private _interrupt : WampMessage.Interrupt;

    constructor(private _name: string, private _msg: WampMessage.Invocation, private _args: InvocationArgsCallbacks,) {
        this._args.expectInterrupt$ = this._args.expectInterrupt$.publishFreeReplay(1);
    }

    async handle(f: (args: InvocationRequest) => any | Promise<any>) {
        try {
            let result = await f(this);
            if (!this.isHandled) {
                await this.return({
                    args: [],
                    kwargs: result
                }, {});
            }
        }
        catch (err) {
            if (!this.isHandled) {
                await this.error({
                    reason: WampUri.Error.RuntimeError,
                    kwargs: err,
                    args: []
                }, {});
            } else {
                throw err;
            }
        }
    }

    private _send$(msg : WampMessage.Any) {
        if (msg instanceof WampMessage.Error || msg instanceof WampMessage.Yield && !msg.options.progress) {
            this.isHandled = true;
        }
        return this._args.send$(msg);
    }

    async return(result: WampResult, options ?: WampYieldOptions) {
        await this._send$(this._args.factory.yield(this._msg.requestId, options, result.args, result.kwargs)).drain();
    }

    async error(error: WampError, details ?: WampObject) {
        await this._send$(this._args.factory.error(WampType.INVOCATION, this._msg.requestId, details, error.reason, error.args, error.kwargs));
    }

    async waitCancel(time = 0) {
        return this._args.expectInterrupt$.takeUntil(most.of(0).delay(time)).flatMap(x => {
            return this._send$(this._args.factory.error(WampType.INVOCATION, this._msg.requestId, {}, WampUri.Error.Canceled)).continueWith(() => {
                throw Errs.Invocation.cancelled(this.name, x);
            });
        }).drain();
    }
}