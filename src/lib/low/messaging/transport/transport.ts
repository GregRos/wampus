import {WampusNetworkError} from "../../../errors/types";
import {WampMessage, WampObject, WampRawMessage} from "../../wamp/messages";
import most = require("most");
import {WampusError} from "../../../errors/types";
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
    /**
     * Creates a COLD stream that, when subscribed to, will send the specified message to the target.
     * @param {object} msg
     * @returns {Stream<never>} A COLD observable.
     */
    send$(msg : WampObject) : Stream<any>;

    /**
     * Exposes a COLD stream that gives access to the transport's network events.
     * Network events include Data, Error, and Completion.
     */
    events : Stream<TransportEvent>;
}

