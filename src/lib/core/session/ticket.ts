import {WampArray, WampMessage, WampObject} from "../protocol/messages";
import {CancelMode, WampEventOptions, WampInvocationOptions, WampResultOptions} from "../protocol/options";
import {
    WampusCallArguments,
    WampusRegisterArguments,
    WampusSendErrorArguments,
    WampusSendResultArguments,
    WampusSubcribeArguments
} from "./message-arguments";
import {Observable} from "rxjs";
import {WampResult} from "../basics";

export interface Ticket {
    close(): Promise<void>;

    readonly isOpen: boolean;
}

export interface CallTicket extends Ticket {
    readonly info: WampusCallArguments & {
        readonly callId: number;
    };
    readonly progress: Observable<CallResultData>;

    close(cancelMode ?: CancelMode): Promise<void>;
}

export interface ProcedureRegistrationTicket extends Ticket {
    readonly invocations: Observable<ProcedureInvocationTicket>;
    readonly info: WampusRegisterArguments & {
        readonly registrationId: number;
    }
}

export interface EventSubscriptionTicket extends Ticket {
    readonly events: Observable<EventInvocationData>;
    readonly info: WampusSubcribeArguments & {
        readonly subscriptionId: number;
    }
}

export interface CallResultData extends WampResult {
    readonly source: CallTicket;

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly isProgress: boolean;

    readonly details: WampResultOptions;
}

export interface EventInvocationData extends WampResult {
    readonly source: EventSubscriptionTicket;

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly details: WampEventOptions;
}

export interface CancellationToken {
    readonly source: ProcedureInvocationTicket;

    readonly received: Date;

    readonly options: WampObject;

    readonly wampMessage : WampMessage.Error;
}

export interface ProcedureInvocationData extends WampResult {
    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly options: WampInvocationOptions;

    readonly name: string;

    readonly invocationId: number;

    readonly isHandled: boolean;
}

export interface ProcedureInvocationTicket extends WampResult {
    readonly source : ProcedureRegistrationTicket;

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly options: WampInvocationOptions;

    readonly name: string;

    readonly invocationId: number;

    readonly isHandled: boolean;

    return(args: WampusSendResultArguments): Promise<void>;

    progress(args: WampusSendResultArguments): Promise<void>;

    error({args, options, kwargs, error}: WampusSendErrorArguments): Promise<void>;

    readonly cancellation: Observable<CancellationToken>;
}