import {WampusIllegalOperationError, WampusInvocationCanceledError} from "../errors/types";
import {WampUri} from "./wamp/uris";
import {WampMessage} from "./wamp/messages";
import {InternalSession} from "./session";
import {WampType} from "./wamp/message.type";
import {WampInvocationOptions} from "./wamp/options";
import {Errs} from "../errors/errors";
import {MessageBuilder} from "./wamp/helper";

export interface DisposableToken {
    dispose() : Promise<void>;
}

export class InvocationArgs {
    isHandled = false;

    get args() {
        return this._msg.args;
    }
    get kwargs() {
        return this._msg.kwargs;
    }
    get options() {
        return this._msg.options;
    }
    constructor(private _msg : WampMessage.Invocation, private _session : InternalSession, private _factory : MessageBuilder) {

    }

    async return(args : any[], kwargs : any) {
        if (this.isHandled) {
            throw Errs.Register.cannotSendResultTwice("X");
        }
        this.isHandled = true;

        await this._session._transport.send(this._factory.yield(this._msg.requestId, {}, args, kwargs)).drain();
    }

    async error(args : any[], kwargs : any) {
        this.isHandled = true;
        await this._session._transport.send(this._factory.error(WampType.INVOCATION, this._msg.requestId, {}, "wamp.error.runtime_error", args, kwargs));
    }
}



export class EventArgs {
    constructor(private _msg : WampMessage.Event) {

    }
}