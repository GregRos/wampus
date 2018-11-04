import * as Core from "../../core/session/ticket";

import {WampusSession} from "../wampus-session";
import {catchError, map} from "rxjs/operators";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {StackTraceService, AbstractWampusSessionServices} from "../services";
import {ProcedureHandler, InvocationTicket} from "./invocation-ticket";
import CallSite = NodeJS.CallSite;
import {WampResult, WampusRegisterArguments} from "../../core";
import {Ticket} from "./ticket";
import {makeEverythingNonEnumerableExcept} from "../../utils/object";
export class RegistrationTicket extends Ticket {
    trace = {
        created : null as CallSite[]
    };
    private _base : Core.ProcedureRegistrationTicket;
    private _services : AbstractWampusSessionServices;
    constructor(never : never) {
		super();
	}

    static async create(registering : Promise<Core.ProcedureRegistrationTicket>, services : AbstractWampusSessionServices) {
        let trace = services.stackTraceService.capture(RegistrationTicket.create);
        let coreTicket = await registering.catch(err => {
	        if (trace) err.trace = services.stackTraceService.format(err, trace);
            throw err;
        });

        let ticket = new RegistrationTicket(null as never);
        ticket.trace.created = trace;
        ticket._base = coreTicket;
        ticket._services = services;
        makeEverythingNonEnumerableExcept(ticket);
        return ticket;
    }

    get info() {
        return this._base.info;
    }

    close(): Promise<void> {
        return this._base.close();
    }

	/**
	 * @internal
	 * @param handler
	 * @private
	 */
	_handle(handler : ProcedureHandler) {
        this._invocations.subscribe(myTicket => {
	        myTicket._handle(handler);
        });
    }

    private get _invocations() {
        let myTrace = this._services.stackTraceService.capture(Object.getOwnPropertyDescriptor(RegistrationTicket.prototype, "_invocations").get);
        return this._base.invocations.pipe(map(coreTicket => {
            let newTicket = new InvocationTicket(coreTicket, this._services, this);
            return newTicket;
        }), catchError(err => {
        	if (myTrace) err.stack = this._services.stackTraceService.format(err, myTrace);
            throw err;
        }));
    }

    get isOpen() {
        return this._base.isOpen;
    }
}
makeEverythingNonEnumerableExcept(InvocationTicket.prototype, "info");

