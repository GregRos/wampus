import * as Core from "../core";
import {WampusCoreSession} from "../core/session/core-session";
import {catchError, endWith, first, flatMap, map, pairwise, startWith, take, takeUntil, tap} from "rxjs/operators";
import {WampusInvocationError} from "../core/errors/types";
import {defaultStackService, defaultTransformSet, StackTraceService, TransformSet} from "./services";
import _ = require("lodash");
import CallSite = NodeJS.CallSite;
import {WampusCallArguments, WampusRegisterArguments} from "../core";
import {
    CallResultData,
    CallTicket,
    ProcedureHandler,
    ProcedureInvocationTicket,
    ProcedureRegistrationTicket, HandledProcedureInvocationTicket, CancellationTicket
} from "./ticket";
import EventEmitter = NodeJS.EventEmitter;
import {Errors} from "./errors";
import {EMPTY, isObservable, Subscription, timer} from "rxjs";
import {RxjsEventAdapter} from "../utils/rxjs-other";
import {MyPromise} from "../utils/ext-promise";
import {Errs} from "../core/errors/errors";
import {ProcedureRegistrationTickets} from "./tickets/procedure-registration-ticket";

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

    call(args: WampusCallArguments): CallTicket {
        let stack = this._captureTrace();
        let coreCallTicket = this._session.call(args);
        let progress = coreCallTicket.progress.pipe(map(prog => {
            let newResult = {
                details: prog.details,
                args: this._config.transforms.objectToJson(prog.args),
                kwargs: this._config.transforms.objectToJson(prog.kwargs),
                isProgress: prog.isProgress,
                source: myCallTicket
            } as CallResultData;
            return newResult;
        }), catchError(err => {
            if (err instanceof WampusInvocationError) {
                let tErr = this._config.transforms.errorResponseToError(err);
                err = tErr || err;
            }
            this._embedStack(err, stack);
            throw err;
        }));
        let em = new RxjsEventAdapter(progress, x => ({name: "data", arg: x}));

        let myCallTicket: CallTicket = {
            info: coreCallTicket.info,
            async close(mode) {
                await coreCallTicket.close(mode);
            },
            progress: progress,
            get result() {
                return progress.pipe(first(x => !x.isProgress)).toPromise()
            },
            get isOpen() {
                return coreCallTicket.isOpen;
            },
            on(name, handler) {
                em.on(name, handler);
            },
            off(name, handler) {
                em.off(name, handler);
            }
        };
        return myCallTicket;
    };

    async register(args ?: WampusRegisterArguments): Promise<ProcedureRegistrationTicket> {
        let coreRegTicket = this._session.register(args);
        return ProcedureRegistrationTickets.create(coreRegTicket, this._config);
    };

    async event(full: WampusSubcribeArguments): Promise<EventSubscriptionTicket> {
        let trace = this._captureTrace();
        let evs = await this._session.event(full);
        let newSub: EventSubscriptionTicket = {
            async close() {
                await evs.close();
            },
            events: evs.events.pipe(map(e => {
                let x = {
                    ...e,
                    kwargs: this._config.transforms.jsonToObject(e.kwargs),
                    args: this._config.transforms.jsonToObject(e.args)
                };
                return x;
            }), catchError(err => {
                this._embedStack(err, trace);
                throw err;
            })),
            get isOpen() {
                return this.isOpen;
            },
            info: evs.info
        };
        return newSub;
    }

    publish(args: WampusPublishArguments): Promise<void> {
        let trace = this._captureTrace();
        return this._session.publish({
            ...args,
            kwargs: this._config.transforms.objectToJson(args.kwargs),
            args: this._config.transforms.objectToJson(args.args)
        }).catch(err => {
            this._embedStack(err, trace);
            throw err;
        });
    };

    private _captureTrace() {
        return this._config.stackTraceService.capture();
    }

    private _embedStack(err: Error, callSites: CallSite[]) {
        return;
        if (!callSites) return;
        err.stack = this._config.stackTraceService.format(callSites);
    }
}
