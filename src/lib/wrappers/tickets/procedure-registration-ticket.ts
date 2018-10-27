import * as Core from "../../core/session/ticket";

import {WampusSession, WampusSessionServices} from "../wampus-session";
import {catchError, map} from "rxjs/operators";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {StackTraceService} from "../services";
import {ProcedureHandler, ProcedureInvocationTicket} from "./procedure-invocation";
import CallSite = NodeJS.CallSite;
import {WampResult} from "../../core";
import {Ticket} from "./ticket";

export function embedTrace(service : StackTraceService, target : Error, trace : CallSite[]) {
    if (!trace) return;
    target.stack = service.format(target, trace);
}

export class ProcedureRegistrationTicket extends Ticket {
    trace = {
        created : null as CallSite[]
    };
    private _base : Core.ProcedureRegistrationTicket;
    private _services : WampusSessionServices;
    constructor(never : never) {
        super();
    }

    static async create(registering : Promise<Core.ProcedureRegistrationTicket>, services : WampusSessionServices) {
        let stack = services.stackTraceService.capture(ProcedureRegistrationTicket.create);
        let coreTicket = await registering.catch(err => {
            embedTrace(services.stackTraceService, err, stack);
            throw err;
        });

        let ticket = new ProcedureRegistrationTicket(null as never);
        ticket.trace.created = stack;
        ticket._base = coreTicket;
        ticket._services = services;
        return ticket;
    }

    get info() {
        return this._base.info;
    }

    close(): Promise<void> {
        return this._base.close();
    }

    private _handle(handler : ProcedureHandler) {
        this._invocations.subscribe(myTicket => {
            (myTicket as any)._handle(handler);
        });
    }

    private get _invocations() {
        let myTrace = this._services.stackTraceService.capture(Object.getOwnPropertyDescriptor(ProcedureRegistrationTicket.prototype, "_invocations").get);
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

}

