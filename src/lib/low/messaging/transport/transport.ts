import {WampusNetworkError} from "../../../errors/types";
import {WampMessage, WampRawMessage} from "../../wamp/messages";
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
     * Creates a COLD observable that sends the specified message object via the transport when subscribed to.
     * The observable never results in a value, but it completes when the sending completes. Unsubscribing does nothing.
     * @param {object} msg
     * @returns {Stream<never>} A COLD observable.
     */
    send(msg : WampMessage.Any) : Stream<any>;

    /**
     * Exposes a HOT observable that allows access to the transport's events. Events include: Messages send to this transport, Errors, and Closing events.
     */
    events : Stream<TransportEvent>;
}

