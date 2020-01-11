import { WampusNetworkError } from "../lib/core/errors/types";

console.log(new WampusNetworkError("Hello, {name}!", {
    name: "Greg"
}));