

export interface TransformContext {
	deeper(subObject : any) : any;
	next(value : any) : any;
}

export type Transformation = (value : any, ctx : TransformContext) => any;

export function compileTransform(steps : Transformation[]) {
	if (steps.length === 0) return (x => x);
	let firstSkip : (this : TransformContext, value : any) => void;
	let curSkip : (this : TransformContext, value : any) => void;
	for (let i = 0; i < steps.length; i++) {
		let z = i;
		let lastNext = curSkip;
		curSkip = function(this : TransformContext, value : any) {
			let step = steps[z];
			this.next = lastNext;
			return step(value, this);
		};
	}
	firstSkip = curSkip;

	let createTransformCtx = () => {
		return {
			deeper(obj) {
				let ctx = createTransformCtx();
				return ctx.next(obj);
			},
			next(x) {
				return firstSkip.call(this, x);
			}
		} as TransformContext;
	};

	return x => {
		let ctx = createTransformCtx();
		return ctx.next(x);
	}
}