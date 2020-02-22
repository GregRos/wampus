import {
    WampusIllegalOperationError,
    WampusInvocationCanceledError,
    WampusNetworkError
} from "~lib/core/errors/types";

// tslint:disable:completed-docs
function partialMatchText(haystack, needles: string[]) {
    return needles.every(s => haystack.toLowerCase().includes(s.toLowerCase()));
}

export namespace MatchError {
    export function network(...msgSubstring: string[]) {
        return err => err instanceof WampusNetworkError && partialMatchText(err.message, msgSubstring);
    }

    export function illegalOperation(...substrings: string[]) {
        return err => err instanceof WampusIllegalOperationError && partialMatchText(err.message, substrings);
    }

}