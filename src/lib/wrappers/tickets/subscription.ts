import {Observable} from "rxjs";
import {WampusSubcribeArguments} from "../../core/session/message-arguments";
import * as Core from "../../core/session/ticket";
import {WampusSessionServices} from "../wampus-session";
import {map} from "rxjs/operators";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {embedTrace} from "./procedure-registration-ticket";
export interface EventInvocationData extends Core.EventInvocationData {
    readonly source : EventSubscriptionTickets;
}
export class EventSubscriptionTickets {
    private _base : Core.EventSubscriptionTicket;
    private _services : WampusSessionServices;
    private _adapter : RxjsEventAdapter<EventInvocationData>;

    constructor(never : never) {

    }
    get events() {
        return this._base.events.pipe(map(x => {
            return {
                args : this._services.transforms.jsonToObject(x.args),
                kwargs : this._services.transforms.jsonToObject(x.kwargs),
                details : x.details,
                source : this
            } as EventInvocationData;
        }));
    };

    static async create(subscribing : Promise<Core.EventSubscriptionTicket>, services : WampusSessionServices) {
        let trace = services.stackTraceService.capture();
        let coreTicket = await subscribing.catch(err => {
            embedTrace(services.stackTraceService, err, trace);
            throw err;
        });
        let ticket = new EventSubscriptionTickets(null as never);
        ticket._base = coreTicket;
        ticket._services = services;
        ticket._adapter = new RxjsEventAdapter(ticket.events, x => {
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

    get isOpen() {
        return this._base.isOpen;
    }

    close(): Promise<void> {
        return this._base.close();
    }

    off(name: "fired", handler: any): void {
        this._adapter.off(name, handler);
    }

    on(name: "fired", handler: (x: EventInvocationData) => void): void {
        this._adapter.on(name, handler);
    }

}