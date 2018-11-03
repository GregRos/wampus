/* istanbul ignore file */
/**@internal*/
export function makeNonEnumerable<T>(obj : T, ...names : (keyof T | string)[]) {
    for (let name of names) {
        let desc = Object.getOwnPropertyDescriptor(obj, name);
        if (!desc) continue;
        desc.enumerable = false;
        Object.defineProperty(desc, name, desc);
    }
}

export function makeEverythingNonEnumerableExcept<T>(obj : T, ...names : (keyof T | string)[]) {
	for (let name of Object.getOwnPropertyNames(obj)) {
		let desc = Object.getOwnPropertyDescriptor(obj, name);
		desc.enumerable = names.includes(name);
		Object.defineProperty(obj, name, desc);
	}
}

export function assignKeepDescriptor(target : any, source : any) {
	for (let k of Object.getOwnPropertyNames(source)) {
		let desc = Object.getOwnPropertyDescriptor(source, k);
		Object.defineProperty(target, k, desc);
	}
	return target;
}