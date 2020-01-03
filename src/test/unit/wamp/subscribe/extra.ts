import test from "ava";
import {SessionStages} from "../../../helpers/dummy-session";
import {MatchError} from "../../../helpers/errors";
import {BrokerFeatures, WampSubscribeOptions} from "typed-wamp";
import {Feature} from "../../../../lib/core/protocol/feature-names";

function testUsingUnsupportedSubscribeOption(option: keyof WampSubscribeOptions, feature: keyof BrokerFeatures, featureName: string, value = true) {
    test(`using subscribe option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        await t.throws(session.topic({
            name: "a",
            options: {
                [option as any]: value
            }
        }), MatchError.illegalOperation(featureName));
    });
}

testUsingUnsupportedSubscribeOption("match", "pattern_based_subscription", Feature.Subscribe.PatternBasedSubscription);