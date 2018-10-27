import * as Core from "../../core/session/ticket";
import {WampusSessionServices, AbstractWampusSessionServices} from "../services";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {catchError, map} from "rxjs/operators";
import {CancelMode} from "../../core/protocol/options";
import CallSite = NodeJS.CallSite;
import {Observable} from "rxjs";
import {publishReplayAutoConnect} from "../../utils/rxjs-operators";
import {Ticket} from "./ticket";

export class CallTicket extends Ticket implements PromiseLike<CallResultData> {
    private _base: Core.CallTicket;
    private _services: WampusSessionServices;
    private _adapter: RxjsEventAdapter<CallResultData>;
    trace = {
        created : null as CallSite[]
    };
    private _replayProgress : Observable<CallResultData>;

    constructor(never: never) {
        super();
    }

    static create(call: Core.CallTicket, services: WampusSessionServices) {
        let ticket = new CallTicket(null as never);
        ticket.trace.created = services.stackTraceService.capture(CallTicket.create);
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
        }), catchError(err => {
            services.stackTraceService.embedTrace(err, ticket.trace.created);
            throw err;
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

    then<TResult1 = CallResultData, TResult2 = never>(onfulfilled?: ((value: CallResultData) => (PromiseLike<TResult1> | TResult1)) | null | undefined, onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | null | undefined): PromiseLike<TResult1 | TResult2> {
        return this.result.then(onfulfilled, onrejected);
    }

    catch(onrejected : (reason : any) => any) : Promise<any> {
        return this.result.catch(onrejected);
    }
}

export interface CallResultData extends Core.CallResultData {
    readonly source: CallTicket;
}