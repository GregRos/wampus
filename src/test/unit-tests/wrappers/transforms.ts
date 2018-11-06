import test from "ava";
import {compileTransform} from "../../../lib/wrappers/services/recursive-transform";
import {Transform} from "stream";

test("empty transform", async t => {
	let empty = [];
	let compiled = compileTransform(empty);
	t.is(compiled(1), 1);
	t.deepEqual(compiled({}), {});
});

test("one transform", async t => {
	let one = compileTransform([v => {
		if (typeof v === "object") {
			return 5;
		} else {
			return v;
		}
	}]);

	t.is(one({}), 5);
	t.is(one(1), 1);
});

test("two transforms", async t => {
	let two = compileTransform([(v, ctx) => {
		if (v === 5) {
			return 6;
		}
		return v;
	}, (x, ctx) => {
		if (x === 10) {
			return ctx.next(5);
		}
		return ctx.next(x);
	}]);
	t.is(two(10), 6);
	t.is(two(5), 6);
	t.is(1, 1);
	t.deepEqual(two({}), {});
});