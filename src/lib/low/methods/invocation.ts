import {WampMessage, WampObject} from "../wamp/messages";
import {WampError} from "./shared";
import {WampUri} from "../wamp/uris";
import {Errs} from "../../errors/errors";
import {WampResult} from "./shared";
import {WampInvocationOptions, WampYieldOptions} from "../wamp/options";

import {MessageBuilder} from "../wamp/helper";
import {WampType} from "../wamp/message.type";
import {MyPromise} from "../../ext-promise";
import {WampusInvocationCanceledError} from "../../errors/types";
import {concat, defer, Observable, of, throwError, timer} from "rxjs";
import {delay, flatMap, publishReplay, takeUntil} from "rxjs/operators";
export interface InvocationArgsCallbacks {
    factory : MessageBuilder;
    send$(msg : WampMessage.Any) : Observable<void>;
    expectInterrupt$ : Observable<WampMessage.Interrupt>;
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
        this._args.expectInterrupt$ = this._args.expectInterrupt$.pipe(publishReplay(1));
    }


    private _send$(msg : WampMessage.Any) {
        if (msg instanceof WampMessage.Error || msg instanceof WampMessage.Yield && !msg.options.progress) {
            if (this.isHandled) {
                return throwError(Errs.Register.cannotSendResultTwice(this.name));
            } else {
                this.isHandled = true;
            }
        }
        return this._args.send$(msg);
    }

    async handle(handler : (inv : InvocationRequest) => Promise<any>) {
        let invocation = this;
        try {
            let result = await handler(this);
            if (!this.isHandled) {
                await invocation.return({
                    args: [],
                    kwargs: result
                }, {});
            }
        }
        catch (err) {
            if (!this.isHandled) {
                await invocation.error({
                    reason: WampUri.Error.RuntimeError,
                    kwargs: err,
                    args: []
                }, {});
            } else {
                throw err;
            }
        }
    }

    return$(result: WampResult, options ?: WampYieldOptions) {
        return this._send$(this._args.factory.yield(this._msg.requestId, options, result.args, result.kwargs));
    }

    async return(result: WampResult, options ?: WampYieldOptions) {
        await this.return$(result, options).toPromise();
    }

    error$(error: WampError, details ?: WampObject) {
        return this._send$(this._args.factory.error(WampType.INVOCATION, this._msg.requestId, details, error.reason, error.args, error.kwargs));
    }

    async error(error : WampError, details ?: WampObject) {
        return this.error$(error, details);
    }

    waitCancel$(time = 0) {
        let waitForTime = takeUntil(timer(time));
        let throwCancel$ = throwError(Errs.Invocation.cancelled())
        let handleInterrupt = flatMap((x : WampMessage.Any) => {
            return concat(this.error$({
                reason : WampUri.Error.Canceled
            }), throwCancel$);
        });

        return this._args.expectInterrupt$.pipe(waitForTime).pipe(handleInterrupt);
    }

    waitCancel(time = 0) {
        return this.waitCancel$(time).toPromise();
    }
}
