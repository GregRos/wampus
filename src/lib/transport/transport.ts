import {WampusError, WampusNetworkError} from "../errors/errors";
import {WampMessage, WampRawMessage} from "../proto/messages";
import most = require("most");
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
    data : WampMessage.Any;
}

export interface TransportError {
    type : "error";
    data : WampusError;
}

export type TransportEvent = TransportError | TransportMessage | TransportClosed;

export interface WampusTransport {
    send(msg : WampMessage.Any) : Promise<void>;
    events : most.Stream<TransportEvent>;
    messages : most.Stream<WampMessage.Any>;
    close() : Promise<void>;
}

