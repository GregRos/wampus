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

	private _services: WampusSessionServices;

	constructor(public _core: WampusCoreSession, initServices: NewObjectInitializer<AbstractWampusSessionServices>) {
		let svcs = _.cloneDeep({
			stackTraceService: defaultStackService,
			transforms: defaultTransformSet
		});
		initServices && initServices(svcs);
		this._services = new WampusSessionServices(svcs);
	}

	get realm() {
		return this._core.realm;
	}

	get isActive() {
		return this._core.isActive;
	}

	close() {
		return this._core.close();
	}

	call(name: string, args ?: WampArray, kwargs ?: WampObject, options ?: WampCallOptions): CallTicket;
	call(args: WampusCallArguments): CallTicket
	call(arg1: string | WampusCallArguments, arg2 ?: WampArray, arg3 ?: WampObject, arg4 ?: WampCallOptions) {
		if (typeof arg1 !== "string") {
			return CallTicket.create(this._core.call(arg1), this._services);
		} else {
			return CallTicket.create(this._core.call({
				name: arg1,
				args: arg2,
				kwargs: arg3,
				options: arg4
			}), this._services);
		}

	};

	register(name: string, handler: ProcedureHandler, options ?: WampRegisterOptions): Promise<ProcedureRegistrationTicket>
	register(args: WampusRegisterArguments, handler: ProcedureHandler): Promise<ProcedureRegistrationTicket>
	async register(arg1: string | WampusRegisterArguments, arg2: ProcedureHandler, arg3 ?: WampRegisterOptions) {
		let obj: WampusRegisterArguments;
		if (typeof arg1 === "string") {
			obj = {
				name: arg1,
				options: arg3
			}
		} else {
			obj = arg1;
		}
		let coreRegTicket = this._core.register(obj);
		let ticket = await ProcedureRegistrationTicket.create(coreRegTicket, this._services);
		(ticket as any)._handle(arg2);
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

	event(name: string, options ?: WampSubscribeOptions): Promise<EventSubscriptionTicket>;
	event(full: WampusSubcribeArguments): Promise<EventSubscriptionTicket>
	async event(arg1: string | WampusSubcribeArguments, arg2 ?: WampSubscribeOptions) {
		let obj: WampusSubcribeArguments;
		if (typeof arg1 === "string") {
			obj = {
				name: arg1,
				options: arg2
			}
		} else {
			obj = arg1;
		}
		return EventSubscriptionTicket.create(this._core.event(obj), this._services);
	}

	publish(name: string, args ?: WampArray, kwargs ?: WampObject, options ?: WampPublishOptions): Promise<void>
	publish(args: WampusPublishArguments): Promise<void>
	publish(arg1: string | WampusPublishArguments, arg2 ?: WampArray, arg3 ?: WampObject, arg4 ?: WampPublishOptions): Promise<void> {
		let obj: WampusPublishArguments;
		if (typeof arg1 === "string") {
			obj = {
				name: arg1,
				options: arg4,
				kwargs: arg3,
				args: arg2
			}
		} else {
			obj = arg1;
		}
		obj = {
			...obj,
			kwargs: this._services.transforms.objectToJson(obj.kwargs),
			args: this._services.transforms.objectToJson(obj.args)
		};
		return this._core.publish(obj);
	};
}
