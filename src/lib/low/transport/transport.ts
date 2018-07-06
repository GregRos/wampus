import {WampusNetworkError} from "../../errors/types";
import {WampMessage, WampRawMessage} from "../wamp/messages";
import most = require("most");
import {WampusError} from "../../errors/types";
import {Stream} from "most";

export interface TransportClosed {
    type : "closed";
    data : any;
}

export interface TransportMessage {
    type : "message";
    data : WampRawMessage;
}

export interface TransportError {
    type : "error";
    data : WampusError;
}

export type TransportEvent = TransportError | TransportMessage | TransportClosed;

export interface Transport {
    send(msg : WampMessage.Any) : Stream<undefined>;
    events : Stream<TransportEvent>;
    close() : Promise<void>;
}

