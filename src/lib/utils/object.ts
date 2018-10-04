export function makeNonEnumerable<T>(obj : T, ...names : (keyof T)[]) {
    for (let name of names) {
        let desc = Object.getOwnPropertyDescriptor(obj, name);
        if (!desc) continue;
        desc.enumerable = false;
        Object.defineProperty(desc, name, desc);
    }
}