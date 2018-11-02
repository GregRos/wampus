export module Errors {
    export function unknownEvent(name : string) {
        return new Error(`Unknown event name ${name}.`);
    }
}