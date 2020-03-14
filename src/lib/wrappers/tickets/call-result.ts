import * as Core from "../../core/session/ticket";
import {WampArray, WampId, WampObject, WampResultDetails} from "typed-wamp";
import {CallTicket} from "./call";


/**
 * A result message sent from the callee.
 */
export class CallResultData implements Core.CallResultData {

    /**
     * The ID of the original RESULT message that delivered this result data.
     */
    readonly id: WampId;

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
        this.id = _base.id;
    }

    /**
     * Whether this call result is a progress result or the final result.
     */
    get isProgress() {
        return this._base.isProgress;
    }

    toString() {
        return `[CallResult (${this.isProgress ? "progress" : "final"}) ${this.source.info.name}, id #${this.id}]`;
    }

}