import test from "ava";
import {SessionStages} from "~test/helpers/mocks/mocked-transport-session";
import {MatchError} from "~test/helpers/error-matchers";
import {BrokerFeatures, WampPublishOptions} from "typed-wamp";


function testUsingUnsupportedPublishOption(option: keyof WampPublishOptions, feature: keyof BrokerFeatures, featureName: string, value = true) {
    test(`using publish option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session} = await SessionStages.handshaken("a");
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
