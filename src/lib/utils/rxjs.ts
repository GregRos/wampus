import {catchError, filter, flatMap, map, publish, switchMap, takeUntil, takeWhile} from "rxjs/operators";
import {EMPTY, Observable, ObservableInput, of, pipe, UnaryFunction} from "rxjs";

let stopToken = {};
export const skipAfter = function <T>(predicate: (x: T) => boolean) {
    return pipe(switchMap(x => {
        if (predicate(x)) {
            return of(x, stopToken);
        } else {
            return of(x);
        }
    }), takeWhile(x => x !== stopToken)) as UnaryFunction<Observable<T>, Observable<T>>
};

export const completeOnError = function<T>() {
    return catchError(() => {
        return EMPTY;
    })
};

export const publishAutoConnect = function<T>() {
    return pipe(publish(), x => {
        x.connect();
        return x;
    }) as UnaryFunction<Observable<T>, Observable<T>>;
};

export const choose = function<T, S>(projection : (x : T) => S | undefined) {
    return pipe(map(projection), filter(x => x !== undefined))
};