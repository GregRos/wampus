import {timeoutWith} from "rxjs/operators";
import {fromPromise} from "rxjs/internal-compatibility";
import {defer, of} from "rxjs";

export function timeoutPromise(promise: Promise<any>, time: number, fallback?: () => (Promise<any> | unknown)) {
    return fromPromise(promise).pipe(timeoutWith(time, defer(() => {
        let result = fallback();
        if (result instanceof Promise) {
            return result;
        } else {
            return of(result);
        }
    }))).toPromise();
}