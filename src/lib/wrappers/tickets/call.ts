import * as Core from "../../core/session/ticket";
import {WampusSessionServices} from "../wampus-session";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {map} from "rxjs/operators";
import {CancelMode} from "../../core/protocol/options";
import CallSite = NodeJS.CallSite;
import {Observable} from "rxjs";
import {publishReplayAutoConnect} from "../../utils/rxjs-operators";

export class CallTicket {
    private _base: Core.CallTicket;
    private _services: WampusSessionServices;
    private _adapter: RxjsEventAdapter<CallResultData>;
    private _createdTrace: CallSite[];
    private _replayProgress : Observable<CallResultData>;

    constructor(never: never) {

    }

    static create(call: Core.CallTicket, services: WampusSessionServices) {
        let ticket = new CallTicket(null as never);
        ticket._createdTrace = services.stackTraceService.capture();
        ticket._base = call;
        ticket._services = services;
        ticket._replayProgress = call.progress.pipe(map(prog => {
            let newResult = {
                details: prog.details,
                args: services.transforms.objectToJson(prog.args),
                kwargs: services.transforms.objectToJson(prog.kwargs),
                isProgress: prog.isProgress,
                source: ticket
            } as CallResultData;
            return newResult;
        })).pipe(publishReplayAutoConnect());
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
        return this._replayProgress;
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
    readonly source: CallTicket;
}