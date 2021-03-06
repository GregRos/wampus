import * as Core from "../../core/session/ticket";
import {WampResult} from "../../core/basics";
import {timer} from "rxjs";
import {WampusSendErrorArguments, WampusSendResultArguments} from "../../core/session/message-arguments";
import {AbstractWampusSessionServices} from "../services";
import {map, takeUntil} from "rxjs/operators";
import {RegistrationTicket} from "./registration-ticket";
import {WampInvocationDetails, WampArray, WampObject} from "typed-wamp";
import {WampusInvocationCanceledError} from "../../core/errors/types";
import {clone} from "lodash";

/**
 * A ticket for the invocation of a procedure, on the callee's side.
 */
export class InvocationTicket {
    /**
     * The sequential arguments.
     */
    readonly args: WampArray;
    /**
     * The ID of the invocation.
     */
    readonly invocationId: number;
    /**
     * The named arguments.
     */
    readonly kwargs: WampObject;
    /**
     * The WAMP protocol options.
     */
    readonly options: WampInvocationDetails;
    /**
     * The procedure name.
     */
    readonly name: string;

    /**
     * @internal
     * @param _base
     * @param _services
     * @param _source
     */
    constructor(private _base: Core.InvocationTicket, private _services: AbstractWampusSessionServices, private _source: RegistrationTicket) {

        this.args = _base.args ? _base.args.map(_services.in.json.apply.bind(_services.in.json)) : _base.args;
        this.kwargs = _services.in.json.apply(_base.kwargs);
        this.options = _base.options;
        this.name = _base.name;
        this.invocationId = _base.invocationId;

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

    /**
     * Checks if this call has been cancelled, and continues to wait for {{time}} milliseconds for a cancellation request.
     * @param time The time to wait for. Can be 0.
     * @returns A promise that resolves to a {@see CancellationTicket} if one is found, or no value otherwise.
     */
    waitForCancel(time) {
        return this._base.cancellation.pipe(takeUntil(timer(time)), map(token => {
            return {
                ...token,
                throw() {
                    throw new WampusInvocationCanceledError("Invocation has been cancelled", {});
                }
            } as CancellationTicket;
        })).toPromise();
    }

    /**
     * @internal
     * @private
     */
    _handle(handler: ProcedureHandler): void {
        let ticket = this;
        let handleError = async err => {
            if (this._services.stackTraceService.enabled) {
                err.stack = `${err.stack}\n(Wampus Registered At)${this._services.stackTraceService.format("" as any, this.source.trace.created)}`;
            }
            let errResponse = ticket._services.out.error.apply(err);
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
                    return ticket._return(ret);
                }, err => {
                    return handleError(err);
                });
            }
        } catch (err) {
            // tslint:disable-next-line:no-floating-promises
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

    private _applyOutputTransforms<T extends WampResult>(obj: T) {
        let cln = clone(obj);
        cln.args = cln.args ? cln.args.map(this._services.out.json.apply.bind(this._services.out.json)) : cln.args;
        cln.kwargs = this._services.out.json.apply(cln.kwargs);
        return cln;
    }

    private async _error(msg: WampusSendErrorArguments): Promise<void> {
        msg = this._applyOutputTransforms(msg);
        await this._base.error(msg);
    }

    private async _return(args: WampusSendResultArguments): Promise<void> {
        args = this._applyOutputTransforms(args);
        await this._base.return(args);
    }

    toString() {
        return `[Invocation (${this.isHandled ? "finished" : "pending"}) ${this.source.info.name}, id #${this.invocationId}]`;
    }
}

/**
 * A cancellation request from the caller.
 */
export interface CancellationTicket extends Core.CancellationToken {
    throw(): never;
}

/**
 * The type of function that handles a registered procedure call.
 */
export type ProcedureHandler = (ticket: InvocationTicket) => Promise<WampusSendResultArguments>;
