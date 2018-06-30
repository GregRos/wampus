import "../setup";

import {yamprint} from "yamprint";
import _ = require("lodash");

let x = ` 
wamp.error.not_authorized
wamp.error.procedure_already_exists
wamp.2.json
wamp.2.msgpack
wamp.error.protocol_violation
wamp.error.no_such_realm
wamp.close.system_shutdown
wamp.close.goodbye_and_out
wamp.close.close_realm
wamp.error.no_such_subscription
wamp.error.no_such_registration
wamp.error.no_such_procedure
wamp.error.invalid_uri
wamp.error.invalid_argument
wamp.error.authorization_failed
wamp.error.no_such_role
wamp.error.canceled
wamp.error.option_not_allowed
wamp.error.no_eligible_callee
wamp.error.option_disallowed.disclose_me
wamp.error.network_failure
wamp.error.disclose_me.not_allowed
wamp.registration.on_create
wamp.registration.on_register
wamp.registration.on_unregister
wamp.registration.on_delete
wamp.registration.list
wamp.registration.lookup
wamp.registration.match
wamp.registration.get
wamp.registration.list_callees
wamp.registration.count_callees
wamp.reflection.topic.list
wamp.reflection.procedure.list
wamp.reflection.error.list
wamp.reflection.topic.describe
wamp.reflection.procedure.describe
wamp.reflection.error.describe
wamp.reflect.define
wamp.reflect.describe
wamp.reflect.on_define
wamp.reflect.on_undefine
wamp.subscription.on_create
wamp.subscription.on_subscribe
wamp.subscription.on_unsubscribe
wamp.subscription.on_delete
wamp.subscription.list
wamp.subscription.lookup
wamp.subscription.match
wamp.subscription.get
wamp.subscription.list_subscribers
wamp.subscription.count_subscribers
wamp.topic.history.last
wamp.topic.history.since
wamp.topic.history.after
wamp.session.add_testament
wamp.session.flush_testaments
wamp.session.on_join
wamp.session.on_leave
wamp.session.count
wamp.session.list
wamp.session.get
wamp.error.no_such_session
wamp.2.json.batched
wamp.2.msgpack.batched
`;

let obj = {};

function recPut(key : string[], current : Record<string, any> | string[] | string) : any {
    if (current == null) return key.join(".");
    let curKey = key[0] || "";

    if (typeof current === "string") {
        current = [current];
    }
    if (Array.isArray(current)) {
        let partKeys = current.map((x : string) => x.split("."));
        let initial = _.uniq(partKeys.map(x => x[0]));
        if (initial[0] === curKey) {
            current.push(key.join("."));
            return current;
        }
        let obj = {};

        for (let key of partKeys) {
            obj[curKey] = recPut(key.slice(1), obj[curKey]);
        }
        return obj;
    }
    else {
        current[curKey] = recPut(key.slice(1), current[curKey]);
        return current;
    }
}

x.split("\n").forEach(x => {
    if (!x) return;
    obj = recPut(x.split("."), obj);
});

console.log(yamprint(obj));