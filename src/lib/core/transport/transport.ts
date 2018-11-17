import {WampusNetworkError} from "../errors/types";
import {WampMessage, WampObject, WampRawMessage} from "../protocol/messages";
import {WampusError} from "../errors/types";
import {Observable} from "rxjs";

/**
 * An event emitted when the transport is closed.
 */
export interface TransportClosed {
    type : "closed";
	/**
	 * Extra data emitted by the closed transport.
	 */
	data : any;
}

/**
 * An event emitted when the transport receives a message.
 */
export interface TransportMessage {
    type : "message";
	/**
	 * The raw WAMP protocol message received.
	 */
	data : object;
}

/**
 * An event emitted when the transport errors.
 */
export interface TransportError {
    type : "error";
	/**
	 * The wrapped error thrown by the transport.
	 */
	data : WampusError;
}

/**
 * One of three transport events.
 */
export type TransportEvent = TransportError | TransportMessage | TransportClosed;

/**
 * A message transport for WAMP clients.
 */
export interface Transport {
	/**
	 * A friendly name for the transport.
	 */
	readonly name : string;

    /**
     * Creates a COLD stream that, when subscribed to, will complete when the message is finished sending.
     * @param {WampObject} msg The message to send.
     * @returns {Observable<never>} A COLD observable.
     */
    send$(msg : object) : Observable<any>;

    /**
     * Exposes a COLD stream that gives access to the transport's network events.
     * Network events include Data, Error, and Completion.
     */
    readonly events$ : Observable<TransportEvent>;

    close(obj ?: object) : Promise<void>;

    readonly isActive : boolean;
}

