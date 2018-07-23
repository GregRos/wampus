import {WampError, WampResult} from "./shared";
import {WampMessenger} from "../messaging/wamp-messenger";
import {WampMessage} from "../wamp/messages";
import {WampResultOptions} from "../wamp/options";

export class CallResult implements WampResult{

    constructor(private _name : string, private _msg : WampMessage.Result) {

    }

    get name() {
        return this._name;
    }

    get args() {
        return this._msg.args;
    }

    get kwargs() {
        return this._msg.kwargs;
    }

    get isProgress() {
        return this._msg.details.progress || false;
    }

    get details(): WampResultOptions {
        return this._msg.details;
    }
}

