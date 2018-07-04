import {WampusNetworkError} from "../errors/types";
import {WampMessage, WampRawMessage} from "../proto/messages";
import most = require("most");
import {WampusError} from "../errors/types";
export interface WampusCloseEvent {
    expected : boolean;
    data : any;
}

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

export interface WampusTransport {
    send(msg : WampMessage.Any) : Promise<void>;
    events : most.Stream<TransportEvent>;
    close() : Promise<void>;
}

