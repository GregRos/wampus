import {EMPTY, Observable, of, Subject, Subscription, SubscriptionLike} from "rxjs";
import {AbstractCallResult, AbstractEventArgs, AbstractInvocationRequest, WampResult} from "../core/methods/methods";
import {CancelMode, WampEventOptions} from "../protocol/options";
import {
    WampusCallArguments,
    WampusPublishArguments,
    WampusRegisterArguments,
    WampusSendErrorArguments,
    WampusSubcribeArguments
} from "../core/api-parameters";
import {Session} from "../core/session";
import {catchError, finalize, first, flatMap, map, takeUntil, tap} from "rxjs/operators";
import {FullInvocationRequest, ProcedureHandler} from "./methods/invocation";
import {WampusInvocationError} from "../errors/types";
import {WampUri} from "../protocol/uris";
import CallSite = NodeJS.CallSite;
import {defaultStackService, defaultTransformSet, StackTraceService, TransformSet} from "./wrapped-services";
import _ = require("lodash");
import {call} from "when/node";
import {AsyncSubscription, EventSubscription} from "../core/api-types";
import {makeNonEnumerable} from "../utils/object";

export interface FullCallProgress extends AsyncSubscription {
    result: Promise<WampResult>;
    progress(): Observable<AbstractCallResult>;

    close(mode ?: CancelMode): Promise<void>;
}

export interface WrappedRegistration extends AsyncSubscription {
    invocations: Observable<FullInvocationRequest>;

    close(): Promise<void>;

    handle(handler: ProcedureHandler): void;
}

export interface SessionWrapperConfig {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}

export class SessionWrapper {

    //TODO: Change
    constructor(public _session: Session, private _config: SessionWrapperConfig) {
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

    call(args: WampusCallArguments): FullCallProgress {
        let stack = this._captureTrace();
        let callProgress = this._session.call(args);
        let progress = () => callProgress.progress().pipe(map(prog => {
            let newResult = {
                details: prog.details,
                args: this._config.transforms.objectToJson(prog.args),
                kwargs: this._config.transforms.objectToJson(prog.kwargs),
                name: prog.name,
                isProgress: prog.isProgress
            } as AbstractCallResult;
            return newResult;
        }), catchError(err => {
            if (err instanceof WampusInvocationError) {
                let tErr = this._config.transforms.errorResponseToError(err);
                err = tErr || err;
            }
            this._embedStack(err, stack);
            throw err;
        }));

        let partial: FullCallProgress = {
            async close(mode) {
                await callProgress.close(mode);
            },
            progress() {
                return progress();
            },
            get result() {
                return progress().pipe(first(x => !x.isProgress)).toPromise()
            }
        };
        return partial;
    };

    async register(args ?: WampusRegisterArguments): Promise<WrappedRegistration> {
        let trace = this._captureTrace();
        let self = this;
        let reg = await this._session.register(args);
        let invocations = reg.invocations.pipe(map(req => {
            let fullReq: FullInvocationRequest = {
                options: req.options,
                name: req.name,
                args: this._config.transforms.jsonToObject(req.args),
                kwargs: this._config.transforms.jsonToObject(req.kwargs),
                handle(handler: ProcedureHandler) {
                    (async () => {
                        let invocation = this;
                        try {
                            let result = await
                                handler(this);
                            if (!this.isHandled) {
                                await
                                    invocation.return({
                                        args: result.args,
                                        kwargs: result.kwargs,
                                        options: {}
                                    });
                            }
                        }
                        catch (err) {
                            let errResponse = self._config.transforms.errorToErrorResponse(err);
                            if (!this.isHandled) {
                                await invocation.error(errResponse);
                            } else {
                                throw err;
                            }
                        }
                    })();
                },
                return(args) {
                    args = _.cloneDeep(args);
                    args.args = self._config.transforms.objectToJson(args.args);
                    args.kwargs = self._config.transforms.objectToJson(args.kwargs);
                    return req.return(args);
                },
                error(args) {
                    args = _.cloneDeep(args);
                    args.args = self._config.transforms.objectToJson(args.args);
                    args.kwargs = self._config.transforms.objectToJson(args.kwargs);
                    return req.error(args);
                },
                waitCancel(time) {
                    return req.waitCancel(time);
                }
            };
            return fullReq;
        }), catchError(err => {
            this._embedStack(err, trace);
            throw err;
        }));

        let x : WrappedRegistration = {
            invocations : invocations,
            async close() {
                await reg.close();
            },
            handle(handler) {
                invocations.subscribe(x => {
                    x.handle(handler);
                })
            }
        };
        return x;
    };

    async event(args: WampusSubcribeArguments): Promise<EventSubscription> {
        let trace = this._captureTrace();
        let evs = await this._session.event(args);
        let newSub : EventSubscription = {
            async close() {
                await evs.close();
            },
            events : evs.events.pipe(tap(e => {
                e.kwargs = this._config.transforms.jsonToObject(e.kwargs);
                e.args = this._config.transforms.jsonToObject(e.args);
            }), catchError(err => {
                this._embedStack(err, trace);
                throw err;
            }))
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
