import {flatMap} from "lodash";

/**
 * Tickets represent subscriptions, registrations, and other things which can be closed.
 */
export abstract class Ticket {
    static combine(tickets: Ticket[]) {
        let flattenedOthers = flatMap(tickets, x => x instanceof CompoundTicket ? x._inner : [x]);
        return new CompoundTicket(flattenedOthers);
    }

    /**
     * Closes this ticket. Unsubscribes from a topic, unregisters a procedure, etc.
     */
    abstract close(): Promise<void>;

    /**
     * Combines this ticket with others so they can be closed simultaneously.
     * @param others
     */
    add(...others: Ticket[]) {
        return Ticket.combine([this, ...others]);
    }

}

/**
 * A ticket made of several tickets. When it's closed, the child tickets are also closed.
 */
export class CompoundTicket extends Ticket {

    constructor(public _inner: Ticket[]) {
        super();
    }

    async close() {
        await Promise.all(this._inner.map(ticket => ticket.close()));
    }
}