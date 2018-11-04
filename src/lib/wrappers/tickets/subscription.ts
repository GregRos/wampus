import {Observable} from "rxjs";
import {WampusSubcribeArguments} from "../../core/session/message-arguments";
import * as Core from "../../core/session/ticket";
import { AbstractWampusSessionServices} from "../services";
import {map} from "rxjs/operators";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {Ticket} from "./ticket";
import CallSite = NodeJS.CallSite;
import {makeEverythingNonEnumerableExcept} from "../../utils/object";
export interface EventInvocationData extends Core.EventInvocationData {
    readonly source : SubscriptionTicket;
}
export class SubscriptionTicket extends Ticket {
    trace = {
        created : null as CallSite[]
    };
    private _base : Core.EventSubscriptionTicket;
    private _services : AbstractWampusSessionServices;
    private _adapter : RxjsEventAdapter<EventInvocationData>;

    constructor(never : never) {
        super();
    }

    get events() {
        return this._base.events.pipe(map(x => {
            let data =  {
                args : this._services.transforms.jsonToObject(x.args),
                kwargs : this._services.transforms.jsonToObject(x.kwargs),
                details : x.details,
                source : this
            } as EventInvocationData;
            makeEverythingNonEnumerableExcept(data, "args", "kwargs", "details");
            return data;
        }));
    };

    static async create(subscribing : Promise<Core.EventSubscriptionTicket>, services : AbstractWampusSessionServices) {
        let trace =  services.stackTraceService.capture(SubscriptionTicket.create);
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
                name : "event",
                arg : x
            }
        }, ["called"]);
        makeEverythingNonEnumerableExcept(ticket);
        return ticket;
    }

    get info() {
        return this._base.info;
    }

    get isOpen() {
        return this._base.isOpen;
    }

    close(): Promise<void> {
        return this._base.close();
    }

    off(name: "event", handler: any): void {
        this._adapter.off(name, handler);
    }

    on(name: "event", handler: (x: EventInvocationData) => void): void {
        this._adapter.on(name, handler);
    }

}

makeEverythingNonEnumerableExcept(SubscriptionTicket.prototype, "info");