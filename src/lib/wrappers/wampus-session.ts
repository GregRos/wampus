import * as Core from "../core";
import {WampusCoreSession} from "../core/session/core-session";
import {catchError, endWith, first, flatMap, map, pairwise, startWith, take, takeUntil, tap} from "rxjs/operators";
import {WampusInvocationError} from "../core/errors/types";
import {defaultStackService, defaultTransformSet, StackTraceService, TransformSet} from "./services";
import _ = require("lodash");
import CallSite = NodeJS.CallSite;
import {WampusCallArguments, WampusPublishArguments, WampusRegisterArguments, WampusSubcribeArguments} from "../core";
import EventEmitter = NodeJS.EventEmitter;
import {Errors} from "./errors";
import {EMPTY, isObservable, Subscription, timer} from "rxjs";
import {RxjsEventAdapter} from "../utils/rxjs-other";
import {MyPromise} from "../utils/ext-promise";
import {Errs} from "../core/errors/errors";
import {ProcedureRegistrationTickets} from "./tickets/procedure-registration-ticket";
import {CallTickets} from "./tickets/call";
import {EventSubscriptionTickets} from "./tickets/subscription";

export interface WampusSessionServices {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}

export class WampusSession {

    //TODO: Change
    constructor(public _session: WampusCoreSession, private _config: WampusSessionServices) {
        this._config = _config = _config || {};
        this._config.transforms = _.defaults(this._config.transforms, defaultTransformSet);
        this._config.stackTraceService = _.defaults(this._config.stackTraceService, defaultStackService);
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

    call(args: WampusCallArguments): CallTickets {
        return CallTickets.create(this._session.call(args), this._config);
    };

    async register(args : WampusRegisterArguments): Promise<ProcedureRegistrationTickets> {
        let coreRegTicket = this._session.register(args);
        return ProcedureRegistrationTickets.create(coreRegTicket, this._config);
    };

    async event(full: WampusSubcribeArguments): Promise<EventSubscriptionTickets> {
        return EventSubscriptionTickets.create(this._session.event(full), this._config);
    }

    publish(args: WampusPublishArguments): Promise<void> {
        let trace = this._captureTrace();
        return this._session.publish({
            ...args,
            kwargs: this._config.transforms.objectToJson(args.kwargs),
            args: this._config.transforms.objectToJson(args.args)
        });
    };

    private _captureTrace() {
        return this._config.stackTraceService.capture();
    }
}
