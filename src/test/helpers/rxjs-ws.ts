import {WampusNetworkError} from "../../lib/errors/types";

export function isWampusNetErr(err : any, msgSubstring : string) {
    return err instanceof WampusNetworkError && err.message.includes(msgSubstring);
}