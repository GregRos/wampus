import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/rxjs";
import {Operators} from "promise-stuff";
import {MatchError} from "../../../helpers/errors";
import {
    BrokerFeatures, DealerFeatures,
    PublisherFeatures,
    WampPublishOptions,
    WampRegisterOptions
} from "../../../../lib/core/protocol/options";
import {AdvProfile} from "../../../../lib/core/protocol/uris";


function testUsingUnsupportedPublishOption(option : keyof WampRegisterOptions, feature : keyof DealerFeatures, featureName : string, value = true) {
    test(`using register option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session,server} = await SessionStages.handshaken("a");
        await t.throws(session.register({
            name : "a",
            options : {
                [option] : value
            }
        }), MatchError.illegalOperation(featureName));
    });
}

testUsingUnsupportedPublishOption("match", "pattern_based_registration", AdvProfile.Call.PatternRegistration);
testUsingUnsupportedPublishOption("disclose_caller", "caller_identification", AdvProfile.Call.CallerIdentification);
testUsingUnsupportedPublishOption("invoke", "shared_registration", AdvProfile.Call.SharedRegistration);
