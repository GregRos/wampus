/* istanbul ignore file */
import {ExtendedPromiseConstructor, PromiseStuff} from "promise-stuff";

export const MyPromise: ExtendedPromiseConstructor = PromiseStuff.deriveNew(Promise);