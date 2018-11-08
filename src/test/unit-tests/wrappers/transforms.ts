import test from "ava";
import {TransformStep} from "../../../lib/wrappers/services/recursive-transform";

test("one transform", async t => {
	let one = Transformation.compile(v => {
		if (typeof v === "object") {
			return 5;
		} else {
			return v;
		}
	});

	t.is(one({}), 5);
	t.is(one(1), 1);
});

test("two transforms", async t => {
	let two = Transformation.compile((v, ctx) => {
		if (v === 5) {
			return 6;
		}
		return v;
	}, (x, ctx) => {
		if (x === 10) {
			return ctx.next(5);
		}
		return ctx.next(x);
	});
	t.is(two(10), 6);
	t.is(two(5), 6);
	t.is(1, 1);
	t.deepEqual(two({}), {});
});

test("one transform, with recurse", async t => {
	let one = Transformation.compile((v, ctx) => {
		if (v < 5) {
			return "" + v;
		} else {
			return ctx.recurse(v % 5);
		}
	});
	t.is(one(11), "1");
	t.is(one(3), "3");
	t.is(one(20), "0");
});

test("two transform, with next and recurse", async t => {
	let two = Transformation.compile((v, ctx) => {
		return v.toString();
	}, (v, ctx) => {
		if (v && typeof v === "object" && "data" in v) {
			return {
				data: ctx.recurse(v.data)
			};
		} else {
			return ctx.next(v);
		}
	});

	t.deepEqual(two(1), "1");
	t.deepEqual(two({data: 1}), {data: "1"});
	t.deepEqual(two({a: 1}), {}.toString());
	t.deepEqual(two({data: {data: 1}}), {data: {data: "1"}})
});

test("one step, circular refernece", async t => {
	let one = Transformation.compile((v, ctx) => {
		if (v === 5 || v === "a") {
			return ctx.recurse(v);
		}
		return v;
	});

	t.deepEqual(one(4), 4);
	t.throws(() => one(5));
	t.throws(() => one("a"));
	t.is(one("b"), "b");
});

test("circular reference, depth N", async t => {
	let one = Transformation.compile((v, ctx) => {
		if (v >= 10) {
			return v;
		}
		else if (v < 5) {
			return ctx.recurse(v + 1);
		} else {
			return ctx.recurse(v % 5);
		}
	});
	t.is(one(11), 11);
	t.throws(() => one(4));
	t.throws(() => one(6));
	t.throws(() => one(0));

	t.is(one(10), 10);
});

test("no circ reference side by side", async t => {
	let one = Transformation.compile((v, ctx) => {
		if (Array.isArray(v)) {
			return v.map(x => ctx.recurse(x));
		} else {
			return v;
		}
	});

	t.deepEqual(one([5, 5]), [5, 5]);
	let arr = [];
	let arr2 = [arr];
	arr[0] = arr2;
	t.throws(() => one(arr2));
})