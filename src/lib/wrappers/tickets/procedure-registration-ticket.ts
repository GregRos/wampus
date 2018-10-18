import * as Core from "../../core/session/ticket";
import {isObservable, Observable, timer} from "rxjs";
import {WampusSessionServices} from "../wampus-session";
import {
    WampusCallArguments,
    WampusSendErrorArguments,
    WampusSendResultArguments
} from "../../core/session/message-arguments";
import _ = require("lodash");
import {WampResult} from "../../core";
import {catchError, endWith, flatMap, map, pairwise, takeUntil} from "rxjs/operators";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {Errs} from "../../core/errors/errors";
import {StackTraceService} from "../services";
import CallSite = NodeJS.CallSite;
import {CancelMode} from "../../core/protocol/options";

function embedTrace(service : StackTraceService, target : Error, trace : CallSite[]) {
    if (!trace) return;
    target.stack = this._config.stackTraceService.format(trace);
}

export class ProcedureInvocationTickets implements ProcedureInvocationTicket {
    constructor(private _base : Core.ProcedureInvocationTicket, private _services : WampusSessionServices, private _source : ProcedureRegistrationTickets) {

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

    private _applyTransforms<T extends WampResult>(obj : T) {
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

export class ProcedureRegistrationTickets implements ProcedureRegistrationTicket {
    private _createdTrace : CallSite[];
    private _rxAdapter : RxjsEventAdapter<ProcedureInvocationTicket>;
    private _base : Core.ProcedureRegistrationTicket;
    private _services : WampusSessionServices;
    constructor(never : never) {
    }

    static async create(registering : Promise<Core.ProcedureRegistrationTicket>, services : WampusSessionServices) {
        let stack = services.stackTraceService.capture();
        let coreTicket = await registering.catch(err => {
            embedTrace(services.stackTraceService, err, stack);
            throw err;
        });

        let ticket = new ProcedureRegistrationTickets(null as never);
        ticket._createdTrace = stack;
        ticket._base = coreTicket;
        ticket._services = services;
        ticket._rxAdapter = new RxjsEventAdapter(ticket.invocations, x => {
            return {
                name : "called",
                arg : x
            }
        }, ["called"]);
        return ticket;
    }

    get info() {
        return this._base.info;
    }

    close(): Promise<void> {
        return this._base.close();
    }

    get invocations() {
        let myTrace = this._services.stackTraceService.capture();
        return this._base.invocations.pipe(map(coreTicket => {
            let newTicket = new ProcedureInvocationTickets(coreTicket, this._services, this);
            return newTicket;
        }), catchError(err => {
            embedTrace(this._services.stackTraceService, err, myTrace);
            throw err;
        }));
    }

    get isOpen() {
        return this._base.isOpen;
    }

    off(name: "called", handler: Function): void {
        this._rxAdapter.off(name, handler);
    }

    on(name: "called", handler: (invocation: ProcedureInvocationTicket) => void): void {
        this._rxAdapter.on(name, handler);
    }

}export class CallTickets implements CallTicket {
    private _base : Core.CallTicket;
    private _services : WampusSessionServices;
    private _adapter : RxjsEventAdapter<CallResultData>;
    private _createdTrace : CallSite[];
    constructor(never : never) {

    }

    static async create(call : CallTicket, services : WampusSessionServices) {
        let ticket = new CallTickets(null as never);
        ticket._createdTrace = services.stackTraceService.capture();
        ticket._base = call;
        ticket._services = services;
        ticket._adapter = new RxjsEventAdapter(ticket.progress, x => {
            return {
                name : "data",
                arg : x
            }
        }, ["data"]);
        return ticket;
    }
    get info() {
        return this._base.info;
    }

    get isOpen() {
        return this._base.isOpen;
    }

    get progress() {
        return this._base.progress.pipe(map(prog => {
            let newResult = {
                details: prog.details,
                args: this._services.transforms.objectToJson(prog.args),
                kwargs: this._services.transforms.objectToJson(prog.kwargs),
                isProgress: prog.isProgress,
                source: this
            } as CallResultData;
            return newResult;
        }));
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
}

export interface CancellationTicket extends Core.CancellationToken {
    throw() : never;
}

export interface HandledProcedureInvocationTicket extends Core.ProcedureInvocationData {
    progress(obj : WampusSendResultArguments) : Promise<void>;

    waitForCancelRequest(time ?: number) : Promise<CancellationTicket | null>;
}
export type ProcedureHandler = (req: HandledProcedureInvocationTicket) => (Promise<Partial<WampResult>> | Partial<WampResult> | Observable<Partial<WampResult>>)
