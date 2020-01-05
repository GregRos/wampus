import * as Core from "../../core/session/ticket";
import {WampArray, WampObject, WampResultDetails} from "typed-wamp";
import {CallTicket} from "./call";
import objy = require("objectology");

/**
 * A result message sent from the callee.
 */
export class CallResultData implements Core.CallResultData {
    /**
     * The ordered arguments of the call result.
     */
    readonly args: WampArray;

    /**
     * The named arguments of the call result.
     */
    readonly kwargs: WampObject;

    /**
     * The WAMP protocol options of the call result.
     */
    readonly details: WampResultDetails;

    constructor(private _base: Core.CallResultData, public source: CallTicket) {
        this.kwargs = _base.kwargs;
        this.args = _base.args;
        this.details = _base.details;
        objy.configureDescriptorsOwn(this, (x, k) => {
            x.enumerable = ["kwargs", "args", "details"].includes(k as string);
        });
    }

    /**
     * Whether this call result is a progress result or the final result.
     */
    get isProgress() {
        return this._base.isProgress;
    }
}