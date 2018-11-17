import {WampObject} from "../protocol/messages";
import {Observable} from "rxjs";

/**
 * A challenge by the router for authentication.
 */
export interface ChallengeEvent {
    authMethod : string;
    extra : WampObject;
}

/**
 * An authentication response to a challenge.
 */
export interface ChallengeResponse {
    signature ?: string;
    extra ?: any;
}

/**
 * Authenticates the client. Given a challenge event sent by the router, this function will generate a response.
 */
export type AuthenticatorFunction = (events : ChallengeEvent) => Promise<ChallengeResponse> | ChallengeResponse