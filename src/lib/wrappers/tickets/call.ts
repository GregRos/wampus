import * as Core from "../../core/session/ticket";
import {AbstractWampusSessionServices} from "../services";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {catchError, map} from "rxjs/operators";
import {CancelMode, WampResultOptions} from "../../core/protocol/options";
import CallSite = NodeJS.CallSite;
import {Observable} from "rxjs";
import {publishReplayAutoConnect} from "../../utils/rxjs-operators";
import {Ticket} from "./ticket";
import {makeEverythingNonEnumerableExcept, makeNonEnumerable} from "../../utils/object";
import {WampusInvocationError} from "../../core/errors/types";
import {WampArray, WampObject} from "../../core/protocol/messages";

/**
 *
 */
export class CallTicket extends Ticket implements PromiseLike<CallResultData> {
    private _base = undefined as Core.CallTicket;
    private _services = undefined as AbstractWampusSessionServices;
    private _adapter = undefined as RxjsEventAdapter<CallResultData>;
    trace = {
        created : null as CallSite[]
    };
    private _replayProgress : Observable<CallResultData>;

    constructor(never: never) {
        super();
    }

    static create(call: Core.CallTicket, services: AbstractWampusSessionServices) {
        let ticket = new CallTicket(null as never);
        ticket.trace.created = services.stackTraceService.capture(CallTicket.create);
        ticket._base = call;
        ticket._services = services;
        ticket._replayProgress = call.progress.pipe(map(prog => {
        	let newResult = new CallResultData({
		        details: prog.details,
		        args: prog.args ? prog.args.map(services.transforms.jsonToObject.transform) : prog.args,
		        kwargs: services.transforms.jsonToObject.transform(prog.kwargs),
		        isProgress: prog.isProgress,
		        source: ticket
	        }, ticket);
            return newResult;
        }), catchError(err => {
	        if (err instanceof WampusInvocationError) {
	        	err.args = err.args ? err.args.map(services.transforms.jsonToObject.transform) : err.args;
	        	err.kwargs = services.transforms.jsonToObject.transform(err.kwargs);
		        err = services.transforms.errorResponseToError.transform(err)
	        }
        	if (ticket.trace.created) err.stack = services.stackTraceService.format(err, ticket.trace.created);

            throw err;
        })).pipe(publishReplayAutoConnect());
        ticket._adapter = new RxjsEventAdapter(ticket.progress, x => {
            return {
                name: "data",
                arg: x
            }
        }, ["data"]);
	    makeEverythingNonEnumerableExcept(ticket, "info");
        return ticket;
    }

    get info() {
        return this._base.info;
    }

    get isOpen() {
        return this._base.isOpen;
    }

    get progress() {
        return this._replayProgress;
    }

    get result() {
        return this.progress.toPromise();
    }

    close(cancelMode?: CancelMode): Promise<void> {
        return this._base.close(cancelMode);
    }

    off(name: "data", handler: any) {
        this._adapter.off(name, handler);
    }

    on(name: "data", handler: (x: CallResultData) => void): void {
        this._adapter.on(name, handler);
    }

    then<TResult1 = CallResultData, TResult2 = never>(onfulfilled?: ((value: CallResultData) => (PromiseLike<TResult1> | TResult1)) | null | undefined, onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | null | undefined): PromiseLike<TResult1 | TResult2> {
        return this.result.then(onfulfilled, onrejected);
    }

    catch(onrejected : (reason : any) => any) : Promise<any> {
        return this.result.catch(onrejected);
    }
}
makeEverythingNonEnumerableExcept(CallTicket.prototype, "info");

export class CallResultData implements Core.CallResultData {
	readonly args : WampArray
	readonly kwargs : WampObject;
	readonly details : WampResultOptions;

	constructor(private _base : Core.CallResultData, public source : CallTicket) {
		this.kwargs = _base.kwargs;
		this.args = _base.args;
		this.details = _base.details;
		makeEverythingNonEnumerableExcept(this, "kwargs", "args", "details");
	}

	get isProgress() {
		return this._base.isProgress;
	}
}