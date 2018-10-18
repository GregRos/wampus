import * as Core from "../../core/session/ticket";

import {WampusSessionServices} from "../wampus-session";
import {catchError, map} from "rxjs/operators";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {StackTraceService} from "../services";
import {ProcedureInvocationTicket} from "./procedure-invocation";
import CallSite = NodeJS.CallSite;

export function embedTrace(service : StackTraceService, target : Error, trace : CallSite[]) {
    if (!trace) return;
    target.stack = this._config.stackTraceService.format(trace);
}

export class ProcedureRegistrationTicket {
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

        let ticket = new ProcedureRegistrationTicket(null as never);
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
            let newTicket = new ProcedureInvocationTicket(coreTicket, this._services, this);
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

}

