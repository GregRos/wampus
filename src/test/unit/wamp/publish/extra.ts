import test from "ava";
import {SessionStages} from "../../../helpers/dummy-session";
import {MatchError} from "../../../helpers/errors";
import {BrokerFeatures, WampPublishOptions} from "typed-wamp";


function testUsingUnsupportedPublishOption(option: keyof WampPublishOptions, feature: keyof BrokerFeatures, featureName: string, value = true) {
    test(`using publish option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        await t.throws(session.publish({
            name: "a",
            options: {
                [option]: value
            }
        }), MatchError.illegalOperation(featureName));
    });
}

testUsingUnsupportedPublishOption("disclose_me", "publisher_identification", "PublisherIdentification");
testUsingUnsupportedPublishOption("eligible", "subscriber_blackwhite_listing", "SubscriberBlackWhiteListing");
testUsingUnsupportedPublishOption("exclude", "subscriber_blackwhite_listing", "SubscriberBlackWhiteListing");
testUsingUnsupportedPublishOption("eligible_authrole", "subscriber_blackwhite_listing", "SubscriberBlackWhiteListing");
testUsingUnsupportedPublishOption("eligible_authid", "subscriber_blackwhite_listing", "SubscriberBlackWhiteListing");
testUsingUnsupportedPublishOption("exclude_authid", "subscriber_blackwhite_listing", "SubscriberBlackWhiteListing");
testUsingUnsupportedPublishOption("exclude_authrole", "subscriber_blackwhite_listing", "SubscriberBlackWhiteListing");
testUsingUnsupportedPublishOption("exclude_me", "publisher_exclusion", "PublisherExclusion", false);
