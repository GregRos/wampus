import {WampMessage, WampObject} from "../wamp/messages";
import {WampError} from "./shared";
import {WampUri} from "../wamp/uris";
import {Errs} from "../../errors/errors";
import {WampResult} from "./shared";
import {WampInvocationOptions} from "../wamp/options";
import {Stream} from "most";
import {Subject} from "../../most-ext/subject";

export interface InvocationArgsCallbacks {
    error(error: WampError, details ?: WampObject): Promise<void>;

    result(result: WampResult, details ?: WampObject): Promise<void>;

    progress(result: WampResult, details ?: WampObject): Promise<void>;

    expectInterrupt : Stream<WampMessage.Interrupt>;
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

    constructor(private _name: string, private _msg: WampMessage.Invocation, private _args: InvocationArgsCallbacks,) {

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

    async return(result: WampResult, details ?: WampObject) {
        if (this.isHandled) {
            throw Errs.Register.cannotSendResultTwice("X");
        }
        this.isHandled = true;
        await this._args.result(result, details);
    }

    async error(error: WampError, details ?: WampObject) {
        if (this.isHandled) {
            throw Errs.Register.cannotSendResultTwice("X");
        }
        this.isHandled = true;
        await this._args.error(error, details);
    }

    async waitCancel(time = 0) {
        if (this.isHandled) return;

    }
}