import {WampusError, WampusInvalidArgument} from "../../core/errors/types";
import {InvocationTicket} from "../tickets/invocation-ticket";
import {CallTicket} from "../tickets/call";
import {SubscriptionTicket} from "../tickets/subscription";

export type TransformationSource = InvocationTicket | CallTicket | SubscriptionTicket;

export interface TransformerControl<TIn, TOut> {
	recurse(subObject: TIn): TOut;

	next(value: TIn): TOut;
}

export interface TransformStep<TIn, TOut> {
	(value: TIn, ctx: TransformerControl<TIn, TOut>): TOut;
}

export module Transformation {
	export function compile<TIn = any, TOut = any>(...steps: TransformStep<TIn, TOut>[]): (x: TIn) => TOut
	export function compile<TIn = any, TOut = any>(steps: TransformStep<TIn, TOut>[]): (x: TIn) => TOut
	export function compile<TIn, TOut>(arg1 ?: any, ...args: any[]): (x: TIn) => TOut {
		type MyTransform = TransformStep<TIn, TOut>;
		type MyRecursionControl = TransformerControl<TIn, TOut>;
		let steps: MyTransform[];
		if (!arg1) {
			steps = [];
		} else if (Array.isArray(arg1)) {
			steps = arg1;
		} else {
			steps = [arg1, ...args];
		}
		if (steps.length === 0) throw new WampusInvalidArgument("Cannot compile a list with zero transforms", {});
		let firstSkip: (this: MyRecursionControl, value: any) => void;
		let curSkip: (this: MyRecursionControl, value: any) => any;
		for (let i = 0; i < steps.length; i++) {
			let z = i;
			let lastNext = curSkip;
			curSkip = function (this: MyRecursionControl, value: any) {
				let step = steps[z];
				this.next = lastNext;
				return step(value, this);
			};
		}
		firstSkip = curSkip;

		let createTransformCtx = (set: Set<any>) => {
			return {
				recurse(obj) {
					if (set.has(obj)) {
						throw new WampusInvalidArgument("Transformation has tried to do circular recursion.", {
							obj
						});
					}
					set.add(obj);
					try {
						let ctx = createTransformCtx(set);
						let res = ctx.next(obj);
						return res;
					}
					finally {
						set.delete(obj);
					}
				},
				next(x) {
					return firstSkip.call(this, x);
				}} as MyRecursionControl;

		};

		return (x) => {
			let ctx = createTransformCtx(new Set());
			return ctx.next(x);
		}
	}
}

export class StepByStepTransformer<TIn, TOut> {
	private _transforms = [] as TransformStep<TIn, TOut>[];
	private _compiled: (x: TIn) => TOut;

	constructor() {
		this._compiled = null;
	}

	add(...ts: TransformStep<TIn, TOut>[]) {
		for (let t of ts) {
			this._transforms.push(t);
		}
		this._compiled = Transformation.compile(this._transforms);
	}

	get transform() {
		return this._compiled;
	}

}
