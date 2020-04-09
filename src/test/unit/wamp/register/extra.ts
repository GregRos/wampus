import test from "ava";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {MatchError} from "~test/helpers/error-matchers";
import {DealerFeatures, WampRegisterOptions} from "typed-wamp";
import {Feature} from "~lib/core/protocol/feature-names";


function testUsingUnsupportedRegisterOption(option: keyof WampRegisterOptions, feature: keyof DealerFeatures, featureName: string, value = true) {
    test(`using register option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session} = await SessionStages.handshaken("a");
        let err = await t.throwsAsync(session.register({
            name: "a",
            options: {
                [option]: value
            }
        }));
        t.true(MatchError.illegalOperation(featureName)(err));
    });
}

testUsingUnsupportedRegisterOption("match", "pattern_based_registration", Feature.Call.PatternRegistration);
testUsingUnsupportedRegisterOption("disclose_caller", "caller_identification", Feature.Call.CallerIdentification);
testUsingUnsupportedRegisterOption("invoke", "shared_registration", Feature.Call.SharedRegistration);
