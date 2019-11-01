/**
 * Aggregates multiple topic subscriptions into a single ticket.
 */
import {merge, Observable} from "rxjs";
import {EventInvocation, SubscriptionTicket} from "./subscription";
import {RxjsEventAdapter} from "../../utils/rxjs-other";
import {WampusSubcribeArguments} from "../../core/session/message-arguments";
import {Ticket} from "./ticket";
import {values, keys} from "lodash";

export class MultiSubscriptionTicket<T extends string> extends Ticket {
    readonly topic: Record<T, Observable<EventInvocation>>;
    readonly infos: Record<T, WampusSubcribeArguments & {
        readonly subscriptionId: number;
    }>;
    private _emitter: RxjsEventAdapter;

    constructor(private _tickets: SubscriptionTicket[]) {
        super();
        let topics = {} as any;
        let info = {} as any;
        for (let ticket of _tickets) {
            topics[ticket.info.name] = ticket.events;
            info[ticket.info.name] = ticket.info;
        }
        this.topic = topics;
        this.infos = info;

        this._emitter = new RxjsEventAdapter(merge(...values(topics)), x => ({
            name: x.source.info.name,
            arg: x
        }), keys(topics));
    }

    get isOpen() {
        return this._tickets.some(x => x.isOpen);
    }

    on(topic: T, handler: (invocation: EventInvocation) => void) {
        this._emitter.on(topic, handler);
    }

    off(topic: T, handler: (invocation: EventInvocation) => void) {
        this._emitter.off(topic, handler);
    }

    async close(): Promise<void> {
        let allCloseTasks = this._tickets.map(x => x.close());
        await Promise.all(allCloseTasks);
    }
}