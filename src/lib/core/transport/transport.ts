import {WampusNetworkError} from "../errors/types";
import {WampMessage, WampObject, WampRawMessage} from "../protocol/messages";
import {WampusError} from "../errors/types";
import {Observable} from "rxjs";

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
	readonly name : string;
    /**
     * Creates a COLD stream that, when subscribed to, will send the specified message to the target.
     * @param {object} msg
     * @returns {Observable<never>} A COLD observable.
     */
    send$(msg : WampObject) : Observable<any>;

    /**
     * Exposes a COLD stream that gives access to the transport's network events.
     * Network events include Data, Error, and Completion.
     */
    readonly events$ : Observable<TransportEvent>;

    close(obj ?: object) : Promise<void>;

    readonly isActive : boolean;
}

