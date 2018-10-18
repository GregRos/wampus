import {WampObject} from "../protocol/messages";
import {Observable} from "rxjs";

export interface ChallengeEvent {
    authMethod : string;
    extra : WampObject;
}

export interface ChallengeResponse {
    signature ?: string;
    extra ?: any;
}

export type AuthenticationWorkflow = (events : ChallengeEvent) => Promise<ChallengeResponse> | ChallengeResponse