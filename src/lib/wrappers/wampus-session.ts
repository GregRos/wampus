import {WampusCallArguments, WampusPublishArguments, WampusRegisterArguments, WampusSubcribeArguments} from "../core";
import {WampusCoreSession} from "../core/session/core-session";
import {
	AbstractWampusSessionServices, TransformSet
} from "./services";
import {RegistrationTicket} from "./tickets/registration-ticket";
import {CallTicket} from "./tickets/call";
import {SubscriptionTicket} from "./tickets/subscription";
import {ProcedureHandler} from "./tickets/invocation-ticket";
import {WampArray, WampObject} from "../core/protocol/messages";
import {WampCallOptions, WampPublishOptions, WampRegisterOptions, WampSubscribeOptions} from "../core/protocol/options";
import _ = require("lodash");
import {NewObjectInitializer} from "../common/common";
import {Ticket} from "./tickets/ticket";
import {createDefaultServices} from "./services/default-services";



export interface WampusProcedureDefinitions {
	[key : string] : ProcedureHandler | {
		options ?: WampRegisterOptions;
		invocation : ProcedureHandler;
	};
}


export class WampusSession {

	private readonly _services: AbstractWampusSessionServices;

	constructor(private _core: WampusCoreSession, initServices: NewObjectInitializer<AbstractWampusSessionServices>) {
		let services = createDefaultServices();
		initServices && initServices(services);
		this._services = services;
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
			kwargs : this._services.transforms.objectToJson.transform(args.kwargs),
			args : args.args ? args.args.map(this._services.transforms.objectToJson.transform) : args.args
		};
		return CallTicket.create(this._core.call(args), this._services);


	};

	async register(obj: WampusRegisterArguments & {invocation : ProcedureHandler}): Promise<RegistrationTicket> {
		let coreRegTicket = this._core.register(obj);
		let ticket = await RegistrationTicket.create(coreRegTicket, this._services);
		ticket._handle(obj.invocation);
		return ticket;
	};

	async registerAll(procedures : WampusProcedureDefinitions) {
		let tickets = [];
		_.forIn(procedures, (v, k) => {
			let obj = {
				name : k,
				options : {},
				invocation : null
			};
			if (_.isFunction(v)) {
				obj.invocation = v;
			} else {
				obj.options = v.options || {};
				obj.invocation = v.invocation;
			}
			tickets.push(this.register(obj));
		});
		let resolvedTickets = await Promise.all(tickets);
		return Ticket.combine(resolvedTickets);
	}

	topic(full: WampusSubcribeArguments): Promise<SubscriptionTicket> {
		let obj = full;
		return SubscriptionTicket.create(this._core.topic(obj), this._services);
	}

	publish(args: WampusPublishArguments): Promise<void> {
		args = {
			...args,
			kwargs: this._services.transforms.objectToJson.transform(args.kwargs),
			args: args.args ? args.args.map(this._services.transforms.objectToJson.transform) : args.args,
		};
		return this._core.publish(args);
	};
}
