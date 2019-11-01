import {flatMap} from "lodash";


export abstract class Ticket {
    static combine(tickets: Ticket[]) {
        let flattenedOthers = flatMap(tickets, x => x instanceof CompoundTicket ? x._inner : [x]);
        return new CompoundTicket(flattenedOthers);
    }

    abstract close(): Promise<void>;

    add(...others: Ticket[]) {
        return Ticket.combine([this, ...others]);
    }

    using(actions: () => Promise<void>) {
        return actions().then(() => {
            return this.close();
        });
    }
}

export class CompoundTicket extends Ticket {

    constructor(public _inner: Ticket[]) {
        super();
    }

    async close() {
        await Promise.all(this._inner.map(ticket => ticket.close()));
    }
}