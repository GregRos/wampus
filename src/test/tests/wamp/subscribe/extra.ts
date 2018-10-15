import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/rxjs";
import _ = require("lodash");
import {WampType} from "../../../../lib/protocol/message.type";
import {MatchError} from "../../../helpers/errors";
import {Session} from "../../../../lib/core/session";
import {Operators} from "promise-stuff";
import {take} from "rxjs/operators";
import {
    BrokerFeatures,
    DealerFeatures,
    WampRegisterOptions,
    WampSubscribeOptions
} from "../../../../lib/protocol/options";
import {AdvProfile} from "../../../../lib/protocol/uris";

function testUsingUnsupportedSubscribeOption(option : keyof WampSubscribeOptions, feature : keyof BrokerFeatures, featureName : string, value = true) {
    test(`using subscribe option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session,server} = await SessionStages.handshaken("a");
        await t.throws(session.event({
            name : "a",
            options : {
                [option as any] : value
            }
        }), MatchError.illegalOperation(featureName));
    });
}

testUsingUnsupportedSubscribeOption("match", "pattern_based_subscription", AdvProfile.Subscribe.PatternBasedSubscription);