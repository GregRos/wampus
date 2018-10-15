import {CallResultData, ProcedureInvocationTicket, Ticket, WampResult} from "../core/session/ticket";
import {Observable} from "rxjs";
import {CancelMode} from "../core/protocol/options";

export interface ExtendedInvocationTicket extends ProcedureInvocationTicket {
    handle(handler: ProcedureHandler): void;
}

export type ProcedureHandler =(req: ExtendedInvocationTicket) => (Promise<Partial<WampResult>> | Partial<WampResult>)

export interface ExtendedCallTicket extends Ticket {
    result: Promise<WampResult>;

    progress(): Observable<CallResultData>;

    close(mode ?: CancelMode): Promise<void>;
}

export interface ExtendedProcedureRegistrationTicket extends Ticket {
    invocations: Observable<ExtendedInvocationTicket>;

    close(): Promise<void>;

    handle(handler: ProcedureHandler): void;
}