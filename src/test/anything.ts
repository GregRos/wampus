import { WampusNetworkError } from "~lib/core/errors/types";

import {concat, defer, Observable, of, onErrorResumeNext, Subject} from "rxjs";

import {catchError, flatMap, take} from "rxjs/operators";

let theSub;
const obs = new Observable(sub => {
    theSub = sub;
    Promise.resolve().then(() => {
        sub.next(0);
    });
    return {
        unsubscribe(): void {

        }
    }
}).pipe(flatMap(() => {
    return concat(of(0), defer(() => {
        theSub.error(new Error());
        return of(0);
    }))
})).toPromise().then(console.log);
console.log("a");

