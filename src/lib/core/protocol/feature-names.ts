/**
 * A namespace containing WAMP advanced profile feature names for error messages and the like.
 */
export namespace Feature {
    /**
     * Advanced profile features based on procedures.
     */
    export namespace Call {
        export const ProgressReports = "ProgressiveCallResults";
        export const CallTimeouts = "CallTimeout";
        export const CallCancelling = "CallCancelling";
        export const CallerIdentification = "CallerIdentification";
        export const CallTrustLevels = "CallTrustLevels";
        export const PatternRegistration = "PatternBasedRegistration";
        export const SharedRegistration = "SharedRegistration";
    }

    /**
     * Advanced profile features based around events.
     */
    export namespace Subscribe {
        export const SubscriberBlackWhiteListing = "SubscriberBlackWhiteListing";
        export const PublisherIdentification = "PublisherIdentification";
        export const PublisherExclusion = "PublisherExclusion";
        export const PatternBasedSubscription = "PatternBasedSubscription";
    }
}