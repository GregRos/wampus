import {WampEventOptions} from "../wamp/options";
import {WampMessage} from "../wamp/messages";
import {WampResult} from "./shared";

export class EventArgs implements WampResult{
    get args() {
        return this._msg.args;
    }

    get kwargs() {
        return this._msg.kwargs;
    }

    get details(): WampEventOptions {
        return this._msg.details;
    }

    get name() {
        return this._name;
    }

    constructor(private _name: string, private _msg: WampMessage.Event) {

    }
}