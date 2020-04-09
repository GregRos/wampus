import test from "ava";
import {DependencyDeclarations} from "~lib/wrappers/dependency-selector";
import {JsonSerializer} from "~lib/core/serializer/json";
import {WampusInvalidArgument} from "~lib/core/errors/types";
import {MatchError} from "~test/helpers/error-matchers";
const serializer = DependencyDeclarations.serializer;

test("serializer by name - json", t => {
    const dep = serializer("json");
    t.true(dep instanceof JsonSerializer);
});

test("cusotm serializer", t => {
    const custom = {
        id: "abc",
        serialize(x) {
            return "";
        },
        deserialize(x) {
            return {};
        }
    };
    const dep = serializer(custom);
    t.is(dep, custom);
});

test("unknown serializer name throws", t => {
    const err = t.throws(() => serializer("abc" as any));
    t.true(err instanceof WampusInvalidArgument);
    t.true(MatchError.invalidArgument(err, "abc", "unknown serializer"));
});

test("invalid serializer object throws", t => {
    const err = t.throws(() => serializer({aaa: 1} as any));
    t.true(err instanceof WampusInvalidArgument);
    t.assert(MatchError.invalidArgument(err, "invalid serializer"));
});

test("null serializer throws", t => {
    const err = t.throws(() => serializer(null as any));
    t.true(err instanceof WampusInvalidArgument);
    t.assert(MatchError.invalidArgument(err, "invalid serializer"));
});

