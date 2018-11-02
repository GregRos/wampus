import {WampusSession} from "../../../lib/wrappers/wampus-session";

export class LoggingClient {
    constructor(private _session : WampusSession) {

    }

    async log(message : string, rest : any) {
        await this._session.publish("wampus.logging.log", [], {
            $message : message,
            ...rest
        });
    }


}