import * as Core from "../../core/session/ticket";
import {WampResult} from "../../core/basics";
import {isObservable, Observable, timer} from "rxjs";
import {WampusSendErrorArguments, WampusSendResultArguments} from "../../core/session/message-arguments";
import {AbstractWampusSessionServices} from "../services";
import {catchError, endWith, flatMap, map, pairwise, takeUntil} from "rxjs/operators";
import {Errs} from "../../core/errors/errors";
import {RegistrationTicket} from "./registration-ticket";
import _ = require("lodash");
import {Ticket} from "./ticket";
import {ObjectHelpers} from "../../utils/object";
import {WampInvocationOptions, WampYieldOptions} from "../../core/protocol/options";
import {WampusInvocationCanceledError} from "../../core/errors/types";
import {WampArray, WampObject} from "../../core/protocol/messages";


/**
 * A ticket for the invocation of a procedure, on the callee's side.
 */
export class InvocationTicket  {
	/**
	 * The sequential arguments.
	 */
	readonly args : WampArray;
	/**
	 * The ID of the invocation.
	 */
	readonly invocationId : number;
	/**
	 * The named arguments.
	 */
	readonly kwargs : WampObject;
	/**
	 * The WAMP protocol options.
	 */
	readonly options : WampInvocationOptions;
	/**
	 * The procedure name.
	 */
	readonly name : string;

	/**
	 * @internal
	 * @param _base
	 * @param _services
	 * @param _source
	 */
    constructor(private _base: Core.InvocationTicket, private _services: AbstractWampusSessionServices, private _source: RegistrationTicket) {

    	this.args =  _base.args ? _base.args.map(_services.transforms.jsonToObject.transform) : _base.args;
    	this.kwargs = _services.transforms.jsonToObject.transform(_base.kwargs);
    	this.options = _base.options;
    	this.name = _base.name;
	    this.invocationId = _base.invocationId;
	    ObjectHelpers.makeEverythingNonEnumerableExcept(this, "args", "kwargs", "options", "name", "invocationId");
    }

	/**
	 * Whether this invocation has already received the final result.
	 */
	get isHandled() {
        return this._base.isHandled;
    }

	/**
	 * The source {{RegistrationTicket}} for the procedure that created this invocation ticket.
	 */
	get source() {
        return this._source;
    }

    private _applyOutputTransforms<T extends WampResult>(obj: T) {
        let clone = _.clone(obj);
        clone.args = clone.args ? clone.args.map(this._services.transforms.objectToJson.transform) : clone.args;
        clone.kwargs = this._services.transforms.objectToJson.transform(clone.kwargs);
        return clone;
    }

    private async _error(msg: WampusSendErrorArguments): Promise<void> {
        msg = this._applyOutputTransforms(msg);
        await this._base.error(msg);
    }

	/**
	 * Checks if this call has been cancelled, and continues to wait for {{time}} milliseconds for a cancellation request.
	 * @param time The time to wait for. Can be 0.
	 * @returns A promise that resolves to a {{CancellationTicket}} if one is found, or no value otherwise.
	 */
	waitForCancel(time) {
        return this._base.cancellation.pipe(takeUntil(timer(time)), map(token => {
            return {
                ...token,
                throw() {
                    throw new WampusInvocationCanceledError("Invocation has been cancelled", {});
                }
            } as CancellationTicket
        })).toPromise();
    }

	/**
	 * @internal
	 * @param handler
	 * @private
	 */
	_handle(handler: ProcedureHandler): void {
        let ticket = this;
        let handleError = async (err) => {
	        if (this._services.stackTraceService.enabled) {
		        err.stack = err.stack + "\n(Wampus Registered At)" + this._services.stackTraceService.format("" as any, this.source.trace.created);
	        }
            let errResponse = ticket._services.transforms.errorToErrorResponse.transform(err);
            if (!this.isHandled) {
                await ticket._error(errResponse);
            } else {
                throw err;
            }
        };
        try {
            let result = handler(this);
            if (result instanceof Promise) {
                result.then(async ret => {
                    return ticket._return(ret)
                }, err => {
                    return handleError(err);
                });
            }
        }
        catch (err) {
            handleError(err);
        }
    }

	/**
	 * Sends a progress report to the caller.
	 * The message sent by this method will have its `options.progress` field set to true.
	 * @param msg The contents of the progress message.
	 */
	async progress(msg: WampusSendResultArguments): Promise<void> {
        msg = this._applyOutputTransforms(msg);
        await this._base.progress(msg);
    }

    private async _return(args: WampusSendResultArguments): Promise<void> {
        args = this._applyOutputTransforms(args);
        await this._base.return(args);
    }
}

ObjectHelpers.makeEverythingNonEnumerableExcept(InvocationTicket.prototype);

export interface CancellationTicket extends Core.CancellationToken {
    throw(): never;
}

export type ProcedureHandler = (ticket : InvocationTicket) => Promise<WampusSendResultArguments>