import {HelloDetails} from "../core/protocol/options";

export interface WampusConfig {
    realm : string;
    timeout ?: number;
    helloDetails?(details : HelloDetails) : HelloDetails;
    transport() : Transport | Promise<Transport>;
}

export module Wampus {
    export function create() {

    }
}