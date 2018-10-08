import {WampusIllegalOperationError, WampusNetworkError} from "../../lib/errors/types";

function partialMatchText(haystack, needles : string[]) {
    return needles.every(s => haystack.toLowerCase().includes(s.toLowerCase()))
}

export function isWampusNetErr(...msgSubstring : string[]) {
    return err => err instanceof WampusNetworkError && partialMatchText(err.message, msgSubstring);
}

export function isWampusIllegalOperationError(...substrings : string[]) {
    return err => err instanceof WampusIllegalOperationError && partialMatchText(err.message, substrings);
}
