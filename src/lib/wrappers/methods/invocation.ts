import {
    RuntimeErrorToResponse,
    TransformSet,
    WampusSendErrorArguments,
    WampusSendResultArguments
} from "../../core/api-parameters";
import {AbstractInvocationRequest} from "../../core/methods/methods";

export interface FullInvocationRequest extends AbstractInvocationRequest {
    handle(handler: (inv: FullInvocationRequest) => Promise<any>): Promise<void>;

    return(args: WampusSendResultArguments): Promise<void>;

    error(args: WampusSendErrorArguments): Promise<void>;

    waitCancel(time: number): Promise<void>;
}