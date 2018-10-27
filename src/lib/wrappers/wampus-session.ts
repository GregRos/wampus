import {WampusCallArguments, WampusPublishArguments, WampusRegisterArguments, WampusSubcribeArguments} from "../core";
import {WampusCoreSession} from "../core/session/core-session";
import {
    WampusSessionServices,
    AbstractWampusSessionServices} from "./services";
import {ProcedureRegistrationTicket} from "./tickets/procedure-registration-ticket";
import {CallTicket} from "./tickets/call";
import {EventSubscriptionTicket} from "./tickets/subscription";
import {ProcedureHandler} from "./tickets/procedure-invocation";
import {WampArray, WampObject} from "../core/protocol/messages";
import {WampCallOptions, WampPublishOptions, WampRegisterOptions, WampSubscribeOptions} from "../core/protocol/options";
import _ = require("lodash");
import {defaultStackService} from "./services/default-stack-trace-service";
import {defaultTransformSet} from "./services/transform-service";
import {NewObjectInitializer} from "../common";


export class WampusSession {

    //TODO: Change
    private _config : WampusSessionServices;
    constructor(public _session: WampusCoreSession, initServices: NewObjectInitializer<AbstractWampusSessionServices>) {
        let svcs = _.cloneDeep({
            stackTraceService : defaultStackService,
            transforms : defaultTransformSet
        });
        initServices && initServices(svcs);
        this._config = new WampusSessionServices(svcs);
    }

    get realm() {
        return this._session.realm;
    }

    get isActive() {
        return this._session.isActive;
    }

    close() {
        return this._session.close();
    }

    call(name : string, args ?: WampArray, kwargs ?: WampObject, options ?: WampCallOptions) : CallTicket;
    call(args: WampusCallArguments): CallTicket
    call(arg1 : string | WampusCallArguments, arg2 ?: WampArray, arg3 ?: WampObject, arg4 ?: WampCallOptions){
        if (typeof arg1 !== "string") {
            return CallTicket.create(this._session.call(arg1), this._config);
        } else {
            return CallTicket.create(this._session.call({
                name : arg1,
                args : arg2,
                kwargs : arg3,
                options : arg4
            }), this._config);
        }

    };

    register(name : string, handler : ProcedureHandler, options ?: WampRegisterOptions) : Promise<ProcedureRegistrationTicket>
    register(args : WampusRegisterArguments, handler : ProcedureHandler): Promise<ProcedureRegistrationTicket>
    async register(arg1 : string | WampusRegisterArguments, arg2 : ProcedureHandler, arg3 ?: WampRegisterOptions) {
        let obj : WampusRegisterArguments;
        if (typeof arg1 === "string" ){
            obj = {
                name : arg1,
                options : arg3
            }
        } else {
            obj = arg1;
        }
        let coreRegTicket = this._session.register(obj);
        let ticket = await ProcedureRegistrationTicket.create(coreRegTicket, this._config);
        (ticket as any)._handle(arg2);
        return ticket;
    };

     event(name : string, options ?: WampSubscribeOptions) : Promise<EventSubscriptionTicket>;
     event(full: WampusSubcribeArguments): Promise<EventSubscriptionTicket>
    async event(arg1 : string | WampusSubcribeArguments, arg2 ?: WampSubscribeOptions) {
        let obj : WampusSubcribeArguments;
        if (typeof arg1 === "string" ){
            obj = {
                name : arg1,
                options : arg2
            }
        } else {
            obj = arg1;
        }
        return EventSubscriptionTicket.create(this._session.event(obj), this._config);
    }

    publish(name : string, args ?: WampArray, kwargs ?: WampObject, options ?: WampPublishOptions) : Promise<void>
    publish(args: WampusPublishArguments): Promise<void>
    publish(arg1 : string | WampusPublishArguments, arg2 ?: WampArray, arg3 ?: WampObject, arg4 ?: WampPublishOptions) : Promise<void> {
        let obj : WampusPublishArguments;
        if (typeof arg1 === "string") {
            obj = {
                name : arg1,
                options : arg4,
                kwargs : arg3,
                args : arg2
            }
        } else {
            obj = arg1;
        }
        obj = {
            ...obj,
            kwargs : this._config.transforms.objectToJson(obj.kwargs),
            args : this._config.transforms.objectToJson(obj.args)
        };
        return this._session.publish(obj);
    };
}
