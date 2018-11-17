import {WampArray, WampMessage, WampObject} from "../protocol/messages";
import {
	CancelMode,
	WampCallOptions,
	WampEventOptions,
	WampInvocationOptions,
	WampResultOptions
} from "../protocol/options";
import {
    WampusCallArguments,
    WampusRegisterArguments,
    WampusSendErrorArguments,
    WampusSendResultArguments,
    WampusSubcribeArguments
} from "./message-arguments";
import {Observable} from "rxjs";
import {WampResult} from "../basics";

/**
 * Core ticket.
 */
export interface Ticket {
    close(): Promise<void>;

    readonly isOpen: boolean;
}

export interface CallTicketInfo {
	/**
	 * The WAMP protocol options this call was made with.
	 */
	readonly options : WampCallOptions;

	/**
	 * The name of the procedure being invoked.
	 */
	readonly name : string;

	/**
	 * The WAMP protocol ID of the call.
	 */
	readonly callId: number;
}

/**
 * Core call ticket with minimal functionality returned by the CoreWampusSession.
 */
export interface CallTicket extends Ticket {
    readonly info:CallTicketInfo;

	readonly progress: Observable<CallResultData>;

    close(cancelMode ?: CancelMode): Promise<void>;
}

/**
 * Core registration ticket.
 */
export interface RegistrationTicket extends Ticket {
    readonly invocations: Observable<InvocationTicket>;
    readonly info: WampusRegisterArguments & {
        readonly registrationId: number;
    }
}

/**
 * Core subscription ticket.
 */
export interface SubscriptionTicket extends Ticket {
    readonly events: Observable<EventData>;
    readonly info: WampusSubcribeArguments & {
        readonly subscriptionId: number;
    }
}


/**
 * Data from a procedure invocation.
 */
export interface CallResultData extends WampResult {
    readonly source: CallTicket;

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly isProgress: boolean;

    readonly details: WampResultOptions;
}

/**
 * Data for a single procedure invocation.
 */
export interface EventData extends WampResult {
    readonly source: SubscriptionTicket;

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly details: WampEventOptions;
}

/**
 * Token containing cancellation info.
 */
export interface CancellationToken {

	readonly type : "timeout" | "cancel";

    readonly source: InvocationTicket;

    readonly received: Date;

    readonly options: WampObject;
}

/**
 * Core invocation ticket for a procedure invocation.
 */
export interface InvocationTicket extends WampResult {
    readonly source : RegistrationTicket;

    readonly args: WampArray;

    readonly kwargs: WampObject;

    readonly options: WampInvocationOptions;

    readonly name: string;

    readonly invocationId: number;

    readonly isHandled: boolean;

    return(args: WampusSendResultArguments): Promise<void>;

    progress(args: WampusSendResultArguments): Promise<void>;

    error({args, details, kwargs, error}: WampusSendErrorArguments): Promise<void>;

    readonly cancellation: Observable<CancellationToken>;
}