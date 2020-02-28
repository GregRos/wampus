import * as Core from "../../core/session/ticket";
import {catchError, map} from "rxjs/operators";
import {AbstractWampusSessionServices} from "../services";
import {InvocationTicket, ProcedureHandler} from "./invocation-ticket";
import {Ticket} from "./ticket";
import objy = require("objectology");
import CallSite = NodeJS.CallSite;

/**
 * A ticket for a procedure registration.
 */
export class RegistrationTicket extends Ticket {
    trace = {
        created: null as CallSite[]
    };
    private _base: Core.RegistrationTicket;
    private _services: AbstractWampusSessionServices;

    constructor(never: never) {
        super();
    }

    /**
     * Info about the registration.
     */
    get info() {
        return this._base.info;
    }

    /**
     * Whether the registration has been closed.
     */
    get isOpen() {
        return this._base.isOpen;
    }

    private get _invocations() {
        let myTrace = this._services.stackTraceService.capture(Object.getOwnPropertyDescriptor(RegistrationTicket.prototype, "_invocations").get);
        return this._base.invocations.pipe(map(coreTicket => {
            return new InvocationTicket(coreTicket, this._services, this);
        }), catchError(err => {
            if (myTrace) err.stack = this._services.stackTraceService.format(err, myTrace);
            throw err;
        }));
    }

    /**
     * @internal
     * @param registering
     * @param services
     */
    static async create(registering: Promise<Core.RegistrationTicket>, services: AbstractWampusSessionServices) {
        let trace = services.stackTraceService.capture(RegistrationTicket.create);
        let coreTicket = await registering.catch(err => {
            if (trace) err.trace = services.stackTraceService.format(err, trace);
            throw err;
        });

        let ticket = new RegistrationTicket(null as never);
        ticket.trace.created = trace;
        ticket._base = coreTicket;
        ticket._services = services;
        return ticket;
    }

    /**
     * Closes the registration.
     */
    close(): Promise<void> {
        return this._base.close();
    }

    /**
     * @internal
     * @param handler
     * @private
     */
    _handle(handler: ProcedureHandler) {
        this._invocations.subscribe(myTicket => {
            myTicket._handle(handler);
        });
    }
}

