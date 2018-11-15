import _ = require("lodash");


export abstract class Ticket {
    abstract close() : Promise<void>;

    static combine(tickets : Ticket[]) {
        let flattenedOthers = _.flatMap(tickets, x => x instanceof CompoundTicket ? x._inner : [x]);
        return new CompoundTicket(flattenedOthers);
    }

    add(...others : Ticket[]) {
        return Ticket.combine([this, ...others]);
    }

    using(actions : () => Promise<void>) {
        return actions().then(x => {
            return this.close();
        })
    }
}

export class CompoundTicket extends Ticket{

    constructor(public _inner : Ticket[]) {
        super();
    }

    async close() {
        await Promise.all(this._inner.map(ticket => ticket.close()));
    }
}