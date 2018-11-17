import {WampMessage} from "../protocol/messages";

/**
 * Reason for a route being forced to complete. Usually the reason for the session being terminated.
 */
export enum WampusCompletionReason {
	/**
	 * The client initiated polite termination.
	 */
	SelfGoodbye = "SelfPoliteTermination",
	/**
	 * The router initiated polite termination.
	 */
	RouterGoodbye = "RouterPoliteTermination",
	/**
	 * The client aborted the session.
	 */
	SelfAbort = "SelfAbort",
	/**
	 * The router aborted the session.
	 */
	RouterAbort = "RouterAbort",
	/**
	 * The router abruptly disconnected.
	 */
	RouterDisconnect = "RouterDisconnect"
}

/**
 * An error thrown onto a route in order to force it to close. This usually happens when the session is closed.
 */
export class WampusRouteCompletion extends Error {

	constructor(public reason: WampusCompletionReason, public msg ?: WampMessage.Any) {
		super("Route completed");
	}

}