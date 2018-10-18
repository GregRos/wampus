import * as Core from "../../core/session/ticket";
import {WampusSessionServices} from "../wampus-session";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {map} from "rxjs/operators";
import {CancelMode} from "../../core/protocol/options";
import CallSite = NodeJS.CallSite;

export class CallTickets {
    private _base: Core.CallTicket;
    private _services: WampusSessionServices;
    private _adapter: RxjsEventAdapter<CallResultData>;
    private _createdTrace: CallSite[];

    constructor(never: never) {

    }

    static create(call: Core.CallTicket, services: WampusSessionServices) {
        let ticket = new CallTickets(null as never);
        ticket._createdTrace = services.stackTraceService.capture();
        ticket._base = call;
        ticket._services = services;
        ticket._adapter = new RxjsEventAdapter(ticket.progress, x => {
            return {
                name: "data",
                arg: x
            }
        }, ["data"]);
        return ticket;
    }

    get info() {
        return this._base.info;
    }

    get isOpen() {
        return this._base.isOpen;
    }

    get progress() {
        return this._base.progress.pipe(map(prog => {
            let newResult = {
                details: prog.details,
                args: this._services.transforms.objectToJson(prog.args),
                kwargs: this._services.transforms.objectToJson(prog.kwargs),
                isProgress: prog.isProgress,
                source: this
            } as CallResultData;
            return newResult;
        }));
    }

    get result() {
        return this.progress.toPromise();
    }

    close(cancelMode?: CancelMode): Promise<void> {
        return this._base.close(cancelMode);
    }

    off(name: "data", handler: any) {
        this._adapter.off(name, handler);
    }

    on(name: "data", handler: (x: CallResultData) => void): void {
        this._adapter.on(name, handler);
    }
}

export interface CallResultData extends Core.CallResultData {
    readonly source: CallTickets;
}