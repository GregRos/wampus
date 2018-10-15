import {WampusIllegalOperationError, WampusInvocationCanceledError, WampusNetworkError} from "../../lib/core/errors/types";
function partialMatchText(haystack, needles : string[]) {
    return needles.every(s => haystack.toLowerCase().includes(s.toLowerCase()))
}

export module MatchError {
    export function network(...msgSubstring : string[]) {
        return err => err instanceof WampusNetworkError && partialMatchText(err.message, msgSubstring);
    }

    export function illegalOperation(...substrings : string[]) {
        return err => err instanceof WampusIllegalOperationError && partialMatchText(err.message, substrings);
    }

    export function cancelled() {
        return err => err instanceof WampusInvocationCanceledError;
    }
}




