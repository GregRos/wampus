import test from "ava";
import {SessionStages} from "../../../helpers/dummy-session";
import {MatchError} from "../../../helpers/errors";
import {BrokerFeatures, WampPublishOptions} from "typed-wamp";


function testUsingUnsupportedPublishOption(option: keyof WampPublishOptions, feature: keyof BrokerFeatures, featureName: string, value = true) {
    test(`using publish option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session, server} = await SessionStages.handshaken("a");
        let err = await t.throwsAsync(session.publish({
            name: "a",
            options: {
                [option]: value
            }
        }));
        t.true(MatchError.illegalOperation(featureName)(err));
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
