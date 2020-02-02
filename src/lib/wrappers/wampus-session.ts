import {WampusCallArguments, WampusPublishArguments, WampusRegisterArguments, WampusSubcribeArguments} from "../core";
import {WampusCoreSession} from "../core/session/core-session";
import {AbstractWampusSessionServices} from "./services";
import {RegistrationTicket} from "./tickets/registration-ticket";
import {CallTicket} from "./tickets/call";
import {SubscriptionTicket} from "./tickets/subscription";
import {ProcedureHandler} from "./tickets/invocation-ticket";
import {WampRegisterOptions, WampSubscribeOptions} from "typed-wamp";
import {NewObjectInitializer} from "../common/common";
import {Ticket} from "./tickets/ticket";
import {createDefaultServices} from "./services/default-services";
import {MultiSubscriptionTicket} from "./tickets/multi-topic";
import {Operators} from "promise-stuff";
import {forIn, isFunction} from "lodash";

async function allWithCleanup<T>(promises: PromiseLike<T>[], cleanup: (x: T) => void) {
    if (promises.length === 0) return [];
    let resolved = [];
    let failed = false;
    promises = promises.map(promise => {
        return Operators.each(promise, x => {
            if (failed) {
                cleanup(x);
            } else {
                resolved.push(x);
            }
        });
    });

    let all = Operators.and(promises[0], ...promises.slice(1)).then(undefined,err => {
        failed = true;
        for (let x of resolved) {
            cleanup(x);
        }
        throw err;
    });

    return all;
}

function isKeyType(x: any): x is keyof any {
    return ["symbol", "number", "string"].indexOf(x) >= 0;
}

/**
 * A specification detailing multiple procedure definitions.
 */
export interface WampusProcedureDefinitions {
    /**
     * Either a handler for a procedure, or else a complex object with both a handler and an options setting.
     */
    [key: string]: ProcedureHandler | {
        options?: WampRegisterOptions;
        called: ProcedureHandler;
    };
}
/**
 * A Wampus session object, representing a single WAMP session.
 */
export class WampusSession extends Ticket {

    /**
     * @internal
     */
    readonly _services: AbstractWampusSessionServices;

    constructor(private _core: WampusCoreSession, initServices: NewObjectInitializer<AbstractWampusSessionServices>) {
        super();
        let services = createDefaultServices();
        initServices && initServices(services);
        this._services = services;
    }

    /**
     * Gets the realm this session belongs to.
     */
    get realm() {
        return this._core.realm;
    }

    /**
     * Gets whether this session is still alive.
     */
    get isActive() {
        return this._core.isActive;
    }

    /**
     * Gets information about this session.
     */
    get details() {
        return this._core.details;
    }

    /**
     * Gets this session's ID.
     */
    get sessionId() {
        return this._core.sessionId;
    }

    /**
     * Exposes the WAMP protocol client used to send and receive protocol messages. This gives you lower-level control over the session.
     * Don't use it unless you know what you're doing.
     */
    get protocol() {
        return this._core.protocol;
    }

    /**
     * Closes this session.
     */
    close() {
        return this._core.close();
    }

    /**
     * Calls a procedure via the WAMP protocol
     * @param wArgs All the information required to make the call.
     * @returns An awaitable call ticket that lets you receive progress from the call.
     */
    call(wArgs: WampusCallArguments): CallTicket {
        wArgs = {
            ...wArgs,
            kwargs: this._services.out.json.apply(wArgs.kwargs),
            args: wArgs.args ? wArgs.args.map(this._services.out.json.apply) : wArgs.args
        };
        return CallTicket.create(this._core.call(wArgs), this._services);
    }

    /**
     * Registers a procedure via the WAMP protocol.
     * @param wArgs All the information needed to register the procedure, including the backing callback.
     * @returns A promise that resolves to a registration ticket once the procedure has been registered.
     */
    async procedure(wArgs: WampusRegisterArguments & { called: ProcedureHandler }): Promise<RegistrationTicket> {
        let coreRegTicket = this._core.register(wArgs);
        let ticket = await RegistrationTicket.create(coreRegTicket, this._services);
        ticket._handle(wArgs.called);
        return ticket;
    }

    /**
     * Registers multiple procedures based on an object specification.
     * @param procedures A procedure specification.
     * @see WampusProcedureDefinitions
     */
    async procedures(procedures: WampusProcedureDefinitions): Promise<Ticket> {
        let tickets = [] as Promise<RegistrationTicket>[];
        forIn(procedures, (v, k) => {
            let obj = {
                name: k,
                options: {},
                called: null
            };
            if (isFunction(v)) {
                obj.called = v;
            } else {
                obj.options = v.options || {};
                obj.called = v.called;
            }
            let procTicket = this.procedure(obj);
            tickets.push(procTicket);

        });
        let resolvedTickets = await allWithCleanup(tickets, x => x.close());
        return Ticket.combine(resolvedTickets);
    }

    async topics<T extends string>(topics: T[], options ?: WampSubscribeOptions): Promise<MultiSubscriptionTicket<T>> {
        let topicTickets = topics.map(x => {
            return {
                name: x as string,
                options
            };
        }).map(x => {
            return this.topic(x);
        });
        let all = await allWithCleanup(topicTickets, x => x.close());
        return new MultiSubscriptionTicket<T>(all);

    }

    /**
     * Subscribes to a topic via the WAMP protocol.
     * @param wArgs All the information needed to create the subscription.
     * @returns A promise that resolves to a subscription ticket that can be used to receive events.
     */
    topic(wArgs: WampusSubcribeArguments): Promise<SubscriptionTicket> {
        return SubscriptionTicket.create(this._core.topic(wArgs), this._services);
    }

    /**
     * Publishes an event via the WAMP protocol.
     * @param wArgs All the information needed to publish the event.
     * @returns A promise that resolves once the event has been published.
     */
    publish(wArgs: WampusPublishArguments): Promise<void> {
        wArgs = {
            ...wArgs,
            kwargs: this._services.out.json.apply(wArgs.kwargs),
            args: wArgs.args ? wArgs.args.map(this._services.out.json.apply) : wArgs.args
        };
        return this._core.publish(wArgs);
    }
}
