import {AbstractCallResult, AbstractEventArgs, AbstractInvocationRequest, WampResult} from "./methods/methods";
import {Observable, Subscription, SubscriptionLike} from "rxjs";
import {CancelMode} from "../protocol/options";
import {FullInvocationRequest} from "../wrappers/methods/invocation";

export interface AsyncSubscription {
    close() : Promise<void>;
}

export interface CallProgress extends AsyncSubscription {
    requestId : number;
    progress() : Observable<AbstractCallResult>;
    /**
     * Cancels the call.
     */
    close(cancelMode ?: CancelMode) : Promise<void>;
}

export interface Registration extends AsyncSubscription {
    invocations : Observable<AbstractInvocationRequest>;
}

export interface EventSubscription extends AsyncSubscription {
    events : Observable<AbstractEventArgs>;
}