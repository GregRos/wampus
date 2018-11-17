import * as Core from "../../core/session/ticket";
import {WampArray, WampObject} from "../../core/protocol/messages";
import {WampResultOptions} from "../../core/protocol/options";
import {ObjectHelpers} from "../../utils/object";
import {CallTicket} from "./call";

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
	readonly details: WampResultOptions;

	constructor(private _base: Core.CallResultData, public source: CallTicket) {
		this.kwargs = _base.kwargs;
		this.args = _base.args;
		this.details = _base.details;
		ObjectHelpers.makeEverythingNonEnumerableExcept(this, "kwargs", "args", "details");
	}

	/**
	 * Whether this call result is a progress result or the final result.
	 */
	get isProgress() {
		return this._base.isProgress;
	}
}