/* istanbul ignore file */
import {ExtendedPromiseConstructor, PromiseStuff} from "promise-stuff";

/**@internal*/
export const MyPromise: ExtendedPromiseConstructor = PromiseStuff.deriveNew(Promise);