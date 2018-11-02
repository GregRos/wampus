import {HelloDetails} from "./protocol/options";
import _metadata = require("../common/_metadata");
/**@internal*/
export const wampusHelloDetails : HelloDetails = {
    agent : `${_metadata.name} v${_metadata.name}`,
    roles: {
        callee: {
            features : {
                call_cancelling : true,
                call_timeout : true,
                call_trustlevels : true,
                caller_identification : true,
                pattern_based_registration : true,
                progressive_call_results : true,
                shared_registration : true,
                sharded_registration : false
            }
        },
        caller: {
            features : {
                call_cancelling : true,
                call_timeout : true,
                caller_identification : true,
                progressive_call_results : true,
                sharded_registration : false
            }
        },
        publisher: {
            features : {
                publisher_exclusion : true,
                publisher_identification : true,
                shareded_subscriptions : false
            }
        },
        subscriber: {
            features : {
                event_history : true,
                pattern_based_subscription : true,
                publication_trustlevels : true,
                publisher_identification : true,
                shareded_subscriptions : false
            }
        }
    }
};