import test from "ava";
import {SessionStages} from "../../../helpers/wamp";
import {Rxjs} from "../../../helpers/observable-monitor";
import _ = require("lodash");
import {WampType} from "../../../../lib/core/protocol/message.type";
import {MatchError} from "../../../helpers/errors";
import {WampusCoreSession} from "../../../../lib/core/session/core-session";
import {Operators} from "promise-stuff";
import {take} from "rxjs/operators";
import {
    BrokerFeatures,
    DealerFeatures,
    WampRegisterOptions,
    WampSubscribeOptions
} from "../../../../lib/core/protocol/options";
import {AdvProfile} from "../../../../lib/core/protocol/uris";

function testUsingUnsupportedSubscribeOption(option : keyof WampSubscribeOptions, feature : keyof BrokerFeatures, featureName : string, value = true) {
    test(`using subscribe option ${option} when unsupported throws error about ${featureName}`, async t => {
        let {session,server} = await SessionStages.handshaken("a");
        await t.throws(session.topic({
            name : "a",
            options : {
                [option as any] : value
            }
        }), MatchError.illegalOperation(featureName));
    });
}

testUsingUnsupportedSubscribeOption("match", "pattern_based_subscription", AdvProfile.Subscribe.PatternBasedSubscription);