import {Observable} from "rxjs";
import * as Core from "../core/session/ticket";
import {WampusSendResultArguments} from "../core/session/message-arguments";
import {WampResult} from "../core/basics";

export interface ProcedureRegistrationTicket extends Core.ProcedureRegistrationTicket {
    readonly invocations: Observable<ProcedureInvocationTicket>;

    close(): Promise<void>;

    on(name : "called", handler : (invocation : ProcedureInvocationTicket) => void) : void;

    off(name : "called", handler : Function) : void;
}

export interface ProcedureInvocationTicket extends Core.ProcedureInvocationTicket {
    readonly source : ProcedureRegistrationTicket;

    handle(handler: ProcedureHandler): void;
}

export interface CancellationTicket extends Core.CancellationToken {
    throw() : never;
}

export interface HandledProcedureInvocationTicket extends Core.ProcedureInvocationData {
    progress(obj : WampusSendResultArguments) : Promise<void>;

    waitForCancelRequest(time ?: number) : Promise<CancellationTicket | null>;
}

export type ProcedureHandler = (req: HandledProcedureInvocationTicket) => (Promise<Partial<WampResult>> | Partial<WampResult> | Observable<Partial<WampResult>>)

export interface CallResultData extends Core.CallResultData {
    readonly source : CallTicket;
}

export interface CallTicket extends Core.CallTicket {
    readonly result: Promise<CallResultData>;

    on(name : "data", handler : (x : CallResultData) => void) : void;

    off(name : "data", handler : any);
}

export interface EventInvocationData extends Core.EventInvocationData {
    readonly source : EventSubscriptionTicket;
}

export interface EventSubscriptionTicket extends Core.EventSubscriptionTicket{
    on(name : "fired", handler : (x : EventInvocationData) => void) : void;

    off(name : "fired", handler : any) : void;
}