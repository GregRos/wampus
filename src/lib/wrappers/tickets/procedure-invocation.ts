import * as Core from "../../core/session/ticket";
import {WampResult} from "../../core/basics";
import {isObservable, Observable, timer} from "rxjs";
import {WampusSendErrorArguments, WampusSendResultArguments} from "../../core/session/message-arguments";
import {WampusSessionServices} from "../wampus-session";
import {catchError, endWith, flatMap, map, pairwise, takeUntil} from "rxjs/operators";
import {Errs} from "../../core/errors/errors";
import {ProcedureRegistrationTickets} from "./procedure-registration-ticket";
import _ = require("lodash");

export class ProcedureInvocationTickets {
    constructor(private _base: Core.ProcedureInvocationTicket, private _services: WampusSessionServices, private _source: ProcedureRegistrationTickets) {

    }

    get args() {
        return this._base.args;
    }

    get cancellation() {
        return this._base.cancellation;
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

    async error(msg: WampusSendErrorArguments): Promise<void> {
        msg = this._applyTransforms(msg);
        await this._base.error(msg);
    }

    handle(handler: ProcedureHandler): void {
        let ticket = this;
        let invocation = {
            args: ticket.args,
            kwargs: ticket.kwargs,
            get isHandled() {
                return ticket.isHandled;
            },
            async progress(o) {
                await ticket.progress(o);
            },
            name: ticket.name,
            options: ticket.options,
            invocationId: ticket.invocationId,
            waitForCancelRequest(time) {
                return ticket.cancellation.pipe(takeUntil(timer(time)), map(token => {
                    return {
                        ...token,
                        throw() {
                            throw Errs.Call.canceled(ticket.name);
                        }
                    } as CancellationTicket
                })).toPromise();
            }
        } as HandledProcedureInvocationTicket;
        let handleError = async (err) => {
            let errResponse = ticket._services.transforms.errorToErrorResponse(err);
            if (!this.isHandled) {
                await ticket.error(errResponse);
            } else {
                throw err;
            }
        };
        try {
            let result = handler(invocation);
            if (result instanceof Promise) {
                result.then(async ret => {
                    return ticket.return(ret)
                }, err => {
                    return handleError(err);
                });
            } else if (isObservable(result)) {
                result.pipe(endWith(null), pairwise(), flatMap(([lastEmission, b]) => {
                    if (!lastEmission) return;
                    if (b === null) {
                        return ticket.return({
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

    async return(args: WampusSendResultArguments): Promise<void> {
        args = this._applyTransforms(args);
        await this._base.return(args);
    }

}

export interface CancellationTicket extends Core.CancellationToken {
    throw(): never;
}

export interface HandledProcedureInvocationTicket extends Core.ProcedureInvocationData {
    progress(obj: WampusSendResultArguments): Promise<void>;

    waitForCancelRequest(time ?: number): Promise<CancellationTicket | null>;
}

export type ProcedureHandler = (req: HandledProcedureInvocationTicket) => (Promise<Partial<WampResult>> | Partial<WampResult> | Observable<Partial<WampResult>>)