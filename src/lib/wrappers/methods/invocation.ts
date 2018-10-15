import {
    WampusSendErrorArguments,
    WampusSendResultArguments
} from "../../core/message-arguments";
import {WampResult} from "../../core/ticket";
import {ProcedureInvocationTicket} from "../../core/ticket";

export interface FullInvocationRequest extends ProcedureInvocationTicket {
    handle(handler: ProcedureHandler): void;
}

export type ProcedureHandler =(req: FullInvocationRequest) => (Promise<Partial<WampResult>> | Partial<WampResult>)
