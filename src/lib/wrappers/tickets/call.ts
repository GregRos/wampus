import * as Core from "../../core/session/ticket";
import {CallTicketInfo} from "../../core/session/ticket";
import {AbstractWampusSessionServices} from "../services";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {catchError, map} from "rxjs/operators";
import {CancelMode} from "../../core/protocol/options";
import {Observable} from "rxjs";
import {publishReplayAutoConnect} from "../../utils/rxjs-operators";
import {Ticket} from "./ticket";
import {ObjectHelpers} from "../../utils/object";
import {WampusInvocationError} from "../../core/errors/types";
import {CallResultData} from "./call-result";
import CallSite = NodeJS.CallSite;

/**
 * An in-progress RPC call via the WAMP protocol.
 */
export class CallTicket extends Ticket implements PromiseLike<CallResultData> {
    private _base = undefined as Core.CallTicket;
    private _services = undefined as AbstractWampusSessionServices;
    private _adapter = undefined as RxjsEventAdapter<CallResultData>;
    trace = {
        created : null as CallSite[]
    };
    private _replayProgress : Observable<CallResultData>;

	/**
	 * Should not be called from user code.
	 * @param never
	 */
	constructor(never: never) {
        super();
    }

	/**
	 * Creates a new feature-wrapped call ticket using a base ticket and a set of services.
	 * Should not normally be called from user code.
	 * @param call The base ticket provided by the WampusCoreSession object.
	 * @param services
	 */
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
	    ObjectHelpers.makeEverythingNonEnumerableExcept(ticket, "info");
        return ticket;
    }

	/**
	 * Provides info about this RPC call.
	 */
	get info() : CallTicketInfo {
        return this._base.info;
    }

	/**
	 * Whether this call has been finished.
	 */
	get isOpen() : boolean {
        return this._base.isOpen;
    }

	/**
	 * An observable that fires whenever a message is received from the callee.
	 * Sends progress, error, and result messages.
	 */
	get progress() : Observable<CallResultData> {
        return this._replayProgress;
    }

	/**
	 * Returns a promise that resolves with the final result of the call.
	 */
	get result() : Promise<CallResultData> {
        return this.progress.toPromise();
    }

	/**
	 * Cancels the call, or if the call is already finished, does nothing.
	 * @param cancelMode The type of the cancellation, as written in the WAMP specification.
	 */
	close(cancelMode?: CancelMode): Promise<void> {
        return this._base.close(cancelMode);
    }

	/**
	 * Removes a handler.
	 * @param name The name of the event.
	 * @param handler The handler function.
	 */
	off(name: "data", handler: any) {
        this._adapter.off(name, handler);
    }

	/**
	 * Adds a handler.
	 * @param name The name of the event.
	 * @param handler The handler.
	 */
	on(name: "data", handler: (x: CallResultData) => void): void {
        this._adapter.on(name, handler);
    }

	/**
	 * Added so that this call ticket can be awaited or used as a promise.
	 * @see Promise.then
	 * @param onfulfilled
	 * @param onrejected
	 */
	then<TResult1 = CallResultData, TResult2 = never>(onfulfilled?: ((value: CallResultData) => (PromiseLike<TResult1> | TResult1)) | null | undefined, onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | null | undefined): PromiseLike<TResult1 | TResult2> {
        return this.result.then(onfulfilled, onrejected);
    }

	/**
	 * Added so this call ticket can be awaited or used as a promise.
	 * @see Promise.catch
	 * @param onrejected
	 */
	catch(onrejected : (reason : any) => any) : Promise<any> {
        return this.result.catch(onrejected);
    }
}
ObjectHelpers.makeEverythingNonEnumerableExcept(CallTicket.prototype, "info");

