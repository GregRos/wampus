import {Transport, TransportEvent} from "../../lib/core/messaging/transport/transport";
import {Observable, Subject} from "rxjs";
import {WampObject} from "../../lib/protocol/messages";

export class ManualTestTransport implements Transport {
    private _inEvents : Subject<TransportEvent>;
    private _outEvents : Subject<TransportEvent>;

    get events() {
        return this._inEvents.asObservable();
    }

    get outEvents() {
        return this._outEvents.asObservable();
    }

    receiveEvent(event : TransportEvent) {
        this._inEvents.next(event);
    }

    send$(msg: WampObject): Observable<any> {
        return undefined;
    }

}