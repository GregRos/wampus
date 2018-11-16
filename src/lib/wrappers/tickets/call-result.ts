import * as Core from "../../core/session/ticket";
import {WampArray, WampObject} from "../../core/protocol/messages";
import {WampResultOptions} from "../../core/protocol/options";
import {makeEverythingNonEnumerableExcept} from "../../utils/object";
import {CallTicket} from "./call";

export class CallResultData implements Core.CallResultData {
	readonly args: WampArray
	readonly kwargs: WampObject;
	readonly details: WampResultOptions;

	constructor(private _base: Core.CallResultData, public source: CallTicket) {
		this.kwargs = _base.kwargs;
		this.args = _base.args;
		this.details = _base.details;
		makeEverythingNonEnumerableExcept(this, "kwargs", "args", "details");
	}

	get isProgress() {
		return this._base.isProgress;
	}
}