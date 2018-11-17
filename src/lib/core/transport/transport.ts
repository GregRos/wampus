import {WampusError} from "../errors/types";
import {WampObject} from "../protocol/messages";
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
     * Creates a COLD observable that, when subscribed to, will send the given message and complete when the message is finished sending.
     * @param {WampObject} msg The message to send.
     * @returns {Observable<never>} A COLD observable.
     */
    send$(msg : object) : Observable<any>;

    /**
     * Exposes a stream that gives access to the transport's network events.
     */
    readonly events$ : Observable<TransportEvent>;

	/**
	 * Closes the transport, optionally with the given extra data.
	 * @param extra Some extra data that may be used as part of closing the transport.
	 */
	close(extra ?: object) : Promise<void>;

	/**
	 * Whether or not this transport has been closed.
	 */
	readonly isActive : boolean;
}

/**
 * A function that creates and configures a transport instance.
 */
export type TransportFactory = () => (Promise<Transport> | Transport);