import {WampusCallArguments, WampusPublishArguments, WampusRegisterArguments, WampusSubcribeArguments} from "../core";
import {WampusCoreSession} from "../core/session/core-session";
import {
	WampusSessionServices,
	AbstractWampusSessionServices
} from "./services";
import {ProcedureRegistrationTicket} from "./tickets/procedure-registration-ticket";
import {CallTicket} from "./tickets/call";
import {EventSubscriptionTicket} from "./tickets/subscription";
import {ProcedureHandler} from "./tickets/procedure-invocation";
import {WampArray, WampObject} from "../core/protocol/messages";
import {WampCallOptions, WampPublishOptions, WampRegisterOptions, WampSubscribeOptions} from "../core/protocol/options";
import _ = require("lodash");
import {defaultStackService} from "./services/default-stack-trace-service";
import {defaultTransformSet} from "./services/transform-service";
import {NewObjectInitializer} from "../common/common";
import {Ticket} from "./tickets/ticket";



export interface WampusProcedureDefinitions {
	[key : string] : ProcedureHandler | {
		options ?: WampRegisterOptions;
		call : ProcedureHandler;
	};
}
export class WampusSession {

	private readonly _services: WampusSessionServices;

	constructor(private _core: WampusCoreSession, initServices: NewObjectInitializer<AbstractWampusSessionServices>) {
		let svcs = _.cloneDeep({
			stackTraceService: defaultStackService,
			transforms: defaultTransformSet
		});
		initServices && initServices(svcs);
		this._services = new WampusSessionServices(svcs);
	}

	/** @internal */
	test() {

	}

	get realm() {
		return this._core.realm;
	}

	get isActive() {
		return this._core.isActive;
	}

	get details() {
		return this._core.details;
	}

	get sessionId() {
		return this._core.sessionId;
	}

	get protocol() {
		return this._core.protocol;
	}

	close() {
		return this._core.close();
	}

	call(args: WampusCallArguments): CallTicket {
		args = {
			...args,
			kwargs : this._services.transforms.objectToJson(args.kwargs),
			args : this._services.transforms.objectToJson(args.args)
		};
		return CallTicket.create(this._core.call(args), this._services);


	};

	async register(obj: WampusRegisterArguments, handler: ProcedureHandler): Promise<ProcedureRegistrationTicket> {
		let coreRegTicket = this._core.register(obj);
		let ticket = await ProcedureRegistrationTicket.create(coreRegTicket, this._services);
		(ticket as any)._handle(handler);
		return ticket;
	};

	async registerAll(procedures : WampusProcedureDefinitions) {
		let tickets = [];
		_.forIn(procedures, (v, k) => {
			let obj = {
				name : k,
				options : {},
				procedure : null
			};
			if (_.isFunction(v)) {
				obj.procedure = v;
			} else {
				obj.options = v.options || {};
				obj.procedure = v.call;
			}
			tickets.push(this.register(obj, obj.procedure));
		});
		let resolvedTickets = await Promise.all(tickets);
		return Ticket.combine(resolvedTickets);
	}

	topic(full: WampusSubcribeArguments): Promise<EventSubscriptionTicket> {
		let obj = full;
		return EventSubscriptionTicket.create(this._core.topic(obj), this._services);
	}

	publish(args: WampusPublishArguments): Promise<void> {
		args = {
			...args,
			kwargs: this._services.transforms.objectToJson(args.kwargs),
			args: this._services.transforms.objectToJson(args.args)
		};
		return this._core.publish(args);
	};
}
