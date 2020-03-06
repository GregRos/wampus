import * as Core from "../../core/session/ticket";
import {AbstractWampusSessionServices} from "../services";
import {map} from "rxjs/operators";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {Ticket} from "./ticket";
import CallSite = NodeJS.CallSite;
import objy = require("objectology");

/**
 * Represents a single event invocation in a topic.
 */
export interface EventInvocation extends Core.EventData {
    readonly source: SubscriptionTicket;
}

/**
 * A ticket for a topic subscription.
 */
export class SubscriptionTicket extends Ticket {
    trace = {
        created: null as CallSite[]
    };
    private _base: Core.SubscriptionTicket;
    private _services: AbstractWampusSessionServices;
    private _adapter: RxjsEventAdapter;

    constructor(never: never) {
        super();
    }

    /**
     * A hot observable that emits all the events received by this subscription in real time.
     */
    get events() {
        return this._base.events.pipe(map(x => {
            let data = {
                args: x.args ? x.args.map(x => this._services.in.json.apply(x)) : x.args,
                kwargs: this._services.in.json.apply(x.kwargs),
                details: x.details,
                source: this
            } as EventInvocation;

            return data;
        }));
    }

    /**
     * Info about this subscription.
     */
    get info() {
        return this._base.info;
    }

    /**
     * Whether this subscription is still active.
     */
    get isOpen() {
        return this._base.isOpen;
    }

    /**
     * @internal
     * @param subscribing
     * @param services
     */
    static async create(subscribing: Promise<Core.SubscriptionTicket>, services: AbstractWampusSessionServices) {
        let trace = services.stackTraceService.capture(SubscriptionTicket.create);
        let coreTicket = await subscribing.catch(err => {
            if (trace) err.stack = services.stackTraceService.format(err, trace);
            throw err;
        });
        let ticket = new SubscriptionTicket(null as never);
        ticket.trace.created = trace;
        ticket._base = coreTicket;
        ticket._services = services;
        ticket._adapter = new RxjsEventAdapter(ticket.events, x => {
            return {
                name: "event",
                arg: x
            };
        }, ["event"]);


        return ticket;
    }

    /**
     * Closes this subscription.
     */
    close(): Promise<void> {
        return this._base.close();
    }

    /**
     * Removes an event handler from this ticket.
     * @param name The name of the event.
     * @param handler The handler
     */
    off(name: "event", handler: any): void {
        this._adapter.off(name, handler);
    }

    /**
     * Adds an event handler to this ticket.
     * @param name The name of the event.
     * @param handler The handler
     */
    on(name: "event", handler: (x: EventInvocation) => void): void {
        this._adapter.on(name, handler);
    }

    toString() {
        return `[Topic (${this.isOpen ? "active" : "closed"}) ${this.info.name}, id #${this.info.subscriptionId}]`;
    }
}