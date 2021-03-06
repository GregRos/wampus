/* istanbul ignore file */
import {filter, map, publish, publishReplay, switchMap, takeWhile} from "rxjs/operators";
import {Observable, of, pipe, UnaryFunction} from "rxjs";

let stopToken = {};
/**@internal*/
export const skipAfter = function <T>(predicate: (x: T) => boolean) {
    return pipe(switchMap(x => {
        if (predicate(x)) {
            return of(x, stopToken);
        } else {
            return of(x);
        }
    }), takeWhile(x => x !== stopToken)) as UnaryFunction<Observable<T>, Observable<T>>;
};

/**@internal*/
export const publishReplayAutoConnect = function <T>() {
    return pipe(publishReplay(), (x: any) => {
        x.connect();
        return x;
    }) as UnaryFunction<Observable<T>, Observable<T>>;
};
/**@internal*/
export const publishAutoConnect = function <T>() {
    return pipe(publish(), x => {
        x.connect();
        return x;
    }) as UnaryFunction<Observable<T>, Observable<T>>;
};
/**@internal*/
export const choose = function <T, S>(projection: (x: T) => S | undefined) {
    return pipe(map(projection), filter(x => x !== undefined));
};