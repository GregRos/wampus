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
import {makeEverythingNonEnumerableExcept, makeNonEnumerable} from "../../utils/object";


export class InvocationTicket  {
    constructor(private _base: Core.ProcedureInvocationTicket, private _services: AbstractWampusSessionServices, private _source: RegistrationTicket) {
    	makeEverythingNonEnumerableExcept(this);
    }

    get args() {
        return this._base.args;
    }

    get invocationId() {
        return this._base.invocationId;
    }

    get isHandled() {
        return this._base.isHandled;
    }

    get kwargs() {
        return this._base.kwargs;
    }

    get name() {
        return this._base.name;
    }

    get options() {
        return this._base.options;
    }

    get source() {
        return this._source;
    }

    private _applyTransforms<T extends WampResult>(obj: T) {
        let clone = _.clone(obj);
        clone.args = this._services.transforms.objectToJson(clone.args);
        clone.kwargs = this._services.transforms.objectToJson(clone.kwargs);
        return clone;
    }

    private async _error(msg: WampusSendErrorArguments): Promise<void> {
        msg = this._applyTransforms(msg);
        await this._base.error(msg);
    }

    waitForCancel(time) {
        return this._base.cancellation.pipe(takeUntil(timer(time)), map(token => {
            return {
                ...token,
                throw() {
                    throw Errs.Call.canceled(this.name, token.wampMessage);
                }
            } as CancellationTicket
        })).toPromise();
    }

    wrap(args ?: any[], kwargs ?: any) {
        return {
            args,
            kwargs
        } as WampResult;
    }

	/**
	 * @internal
	 * @param handler
	 * @private
	 */
	_handle(handler: ProcedureHandler): void {
        let ticket = this;
        let handleError = async (err) => {
            let errResponse = ticket._services.transforms.errorToErrorResponse(this, err);
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
            } else if (isObservable(result)) {
                result.pipe(endWith(null), pairwise(), flatMap(([lastEmission, b]) => {
                    if (!lastEmission) return;

                    if (b === null) {
                        return ticket._return({
                            ...lastEmission
                        });
                    } else {
                        return ticket.progress({
                            ...lastEmission,
                            options: {
                                progress: true
                            }
                        })
                    }
                }), catchError(err => {
                    return handleError(err);
                }))
            }
        }
        catch (err) {
            handleError(err);
        }
    }

    async progress(msg: WampusSendResultArguments): Promise<void> {
        msg = this._applyTransforms(msg);
        await this._base.progress(msg);
    }

    private async _return(args: WampusSendResultArguments): Promise<void> {
        args = this._applyTransforms(args);
        await this._base.return(args);
    }
}

makeEverythingNonEnumerableExcept(InvocationTicket.prototype, "kwargs", "args", "invocationId");

export interface CancellationTicket extends Core.CancellationToken {
    throw(): never;
}

export type ExpandableFunction<TIn, TOut> = (req : TIn) => (Promise<TOut> | Observable<TOut> | TOut);

export type ProcedureHandler = ExpandableFunction<InvocationTicket, WampResult>;