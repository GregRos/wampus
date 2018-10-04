import {
    WampusSendErrorArguments,
    WampusSendResultArguments
} from "../../core/api-parameters";
import {AbstractInvocationRequest, WampResult} from "../../core/methods/methods";

export interface FullInvocationRequest extends AbstractInvocationRequest {
    handle(handler: ProcedureHandler): void;
}

export type ProcedureHandler =(req: FullInvocationRequest) => (Promise<Partial<WampResult>> | Partial<WampResult>)
