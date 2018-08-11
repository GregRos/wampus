import {EMPTY, Observable, of, Subject, Subscription, SubscriptionLike, TeardownLogic} from "rxjs";
import {AbstractCallResult} from "../core/methods/methods";
import {WampMessage, WampObject, WampUriString} from "../protocol/messages";
import {
    WampCallOptions,
    WampEventOptions,
    WampPublishOptions,
    WampRegisterOptions,
    WampSubscribeOptions, WelcomeDetails
} from "../protocol/options";
import {AbstractInvocationRequest} from "../core/methods/methods";
import {WampResult} from "../core/methods/methods";
import {
    StackTraceService,
    TransformSet,
    WampusCallArguments, WampusPublishArguments, WampusRegisterArguments,
    WampusSendErrorArguments,
    WampusSubcribeArguments
} from "../core/api-parameters";
import {WebsocketTransportConfig} from "../core/messaging/transport/websocket";
import {Session} from "../core/session";
import {catchError, finalize, first, flatMap, map, takeUntil} from "rxjs/operators";
import CallSite = NodeJS.CallSite;
import {Routes} from "../core/messaging/routing/route-helpers";
import {FullInvocationRequest} from "./methods/invocation";
import {AbstractEventArgs} from "../core/methods/methods";
import {WampusInvocationError} from "../errors/types";
import {WampUri} from "../protocol/uris";


export interface CallProgress  {
    result: Promise<WampResult>;

    onProgress(handler: (progressMessage: WampResult) => void): SubscriptionLike;

    cancel(): void;
}

export interface Registration {
    close(): Promise<void>;
}

export interface EventSubscription {
    onEvent(handler: (data: WampResult, options: WampEventOptions) => void) : SubscriptionLike;

    unsubscribe(): Promise<void>;
}

export interface SessionWrapperConfig {
    transforms?: TransformSet;
    stackTraceService?: StackTraceService;
}

function cloneObject(obj: any, clone: (x: any) => any) {
    if (Array.isArray(obj)) {
        return obj.map(x => clone(x));
    }
    else if (typeof obj === "object") {
        let keys = Object.keys(obj);
        let clone = {} as any;
        for (let key of keys) {
            clone[key] = clone(obj[key]);
        }
        return clone;
    }
    else {
        return obj;
    }
}

export class SessionWrapper {
    constructor(private _session: Session, private _config: SessionWrapperConfig) {
        this._config = _config = _config || {};
        this._config.transforms = this._config.transforms || {};
        let transforms = this._config.transforms;
        transforms.objectToJson = transforms.objectToJson || (x => x);
        transforms.jsonToObject = transforms.jsonToObject || (x => x);
        transforms.errorToErrorResponse = transforms.errorToErrorResponse || (x => {
            return {
                kwargs : x,
                reason : WampUri.Error.RuntimeError,
                args : [],
                options : {}
            } as WampusSendErrorArguments
        }) as any;
        transforms.errorResponseToError = transforms.errorResponseToError || (x => {
            return null;
        })
    }

    private _captureTrace() {
        return this._config.stackTraceService.capture();
    }

    call$(args: WampusCallArguments): Observable<AbstractCallResult> {
        let stack = this._captureTrace();
        return this._session.call$(args).pipe(map(prog => {
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
                let tErr = this._config.transforms.errorResponseToError(err.msg);
                err = tErr || err;
            }
            this._embedStack(err, stack);
            throw err;
        }));
    };

    call(args: WampusCallArguments): CallProgress {
        let cancelSignal = Subject.create();
        let progressHandlers = [];
        let resultPromise: Promise<WampResult>;
        let prog : CallProgress = {
            onProgress(handler) {
                let obj = {handler};
                progressHandlers.push(obj);
                return {
                    unsubscribe() {
                        let ix = progressHandlers.indexOf(obj);
                        if (ix < 0) return;
                        progressHandlers.splice(ix, 1);
                    },
                    get closed() {
                        return progressHandlers.includes(obj);
                    }
                }
            },
            get result() {
                return resultPromise;
            },
            cancel() {
                cancelSignal.next();
            }
        };

        resultPromise = this.call$(args).pipe(takeUntil(cancelSignal), flatMap(x => {
            let newResult : AbstractCallResult = {
                name : x.name,
                isProgress : x.isProgress,
                details : x.details,
                kwargs : this._config.transforms.jsonToObject(x.kwargs || {}),
                args : this._config.transforms.jsonToObject(x.args || [])
            };

            if (newResult.isProgress) {
                progressHandlers.forEach(handler => handler(newResult));
                return EMPTY;
            } else {
                return of(newResult);
            }
        }), finalize(() => {
            progressHandlers = [];
        }), first()).toPromise();

        return prog;
    }

    register$(args ?: WampusRegisterArguments): Observable<Observable<FullInvocationRequest>> {
        let trace = this._captureTrace();
        let self = this;
        return this._session.register$(args).pipe(map(obs => {
            let modified = obs.pipe(map(req => {
                let x : FullInvocationRequest= {
                    options : req.options,
                    name : req.name,
                    args : this._config.transforms.jsonToObject(req.args || []),
                    kwargs : this._config.transforms.jsonToObject(req.kwargs || {}),
                    error(args) {
                        return req.error$(args).toPromise();
                    },
                    return(args) {
                        return req.return$(args).toPromise();
                    },
                    waitCancel(time) {
                        return req.waitCancel$(time).toPromise();
                    },
                    async handle(handler: (inv: FullInvocationRequest) => Promise<WampResult>) {
                        let invocation = this;
                        try {
                            let result = await handler(this);
                            if (!this.isHandled) {
                                await invocation.return({
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
                    },
                    return$(args) {
                        args.args = self._config.transforms.objectToJson(args.args || []);
                        args.kwargs = self._config.transforms.objectToJson(args.kwargs || {});
                        return req.return$(args);
                    },
                    error$(args) {
                        args.args = self._config.transforms.objectToJson(args.args || []);
                        args.kwargs = self._config.transforms.objectToJson(args.kwargs || {});
                        return req.error$(args);
                    },
                    waitCancel$(time) {
                        return req.waitCancel$(time);
                    }
                };
                return x;
            }));
            return modified;
        }), catchError(err => {
            this._embedStack(err, trace);
            throw err;
        }));
    };

    register(args : WampusRegisterArguments, procedure: (req: FullInvocationRequest) => Promise<any> | any): Promise<SubscriptionLike> {
        return new Promise((resolve, reject) => {
            let isResolved = true;
            let parentSub = this.register$(args).subscribe(innerRx => {
                let sub = innerRx.subscribe(invocation => {
                    invocation.handle(procedure).then(() => {
                    }, () => {
                    });
                });
                isResolved = true;
                resolve({
                    unsubscribe() {
                        sub.unsubscribe();
                        parentSub.unsubscribe();
                    },
                    get closed() {
                        return parentSub.closed;
                    }
                });
            }, (err) => {
                if (!isResolved) {
                    isResolved = true;
                    reject(err);
                }
            });
        });
    }

    event$(args : WampusSubcribeArguments): Observable<Observable<AbstractEventArgs>> {
        let trace = this._captureTrace();
        return this.event$(args).pipe(map(obs => {
            let modified = obs.pipe(map(x => {
                return x;
            }));
            return modified;
        }), catchError(err => {
            this._embedStack(err, trace);
            throw err;
        }))
    }

    event(args : WampusSubcribeArguments, handler ?: (data: WampusSubcribeArguments) => void): Promise<EventSubscription> {
        let sub : Subscription;
        return new Promise<Observable<AbstractEventArgs>>((resolve, reject) => {
            let subscription = this.event$(args).pipe(map(x => {
                resolve(x);
            })).subscribe();
            sub = subscription;
        }).then(a => {
            let handlers = []
            return {
                unsubscribe() {
                    handlers = [];
                    sub.unsubscribe();
                },
                onEvent(handler) {
                    let obj = {handler};
                    handlers.push(obj);
                    return {
                        unsubscribe() {
                            let ix = handlers.indexOf(obj);
                            if (ix < 0) return;
                            handlers.splice(ix, 1);
                        },
                        get closed() {
                            return handlers.includes(obj);
                        }
                    }
                }
            } as EventSubscription
        });
    }

    publish$(args : WampusPublishArguments): Observable<void> {
        let trace = this._captureTrace();
        return this.publish$({
            ...args,
            kwargs : this._config.transforms.objectToJson(args.kwargs || {}),
            args : this._config.transforms.objectToJson(args.args || [])
        }).pipe(catchError(err => {
            this._embedStack(err, trace);
            throw err;
        }));
    };

    publish(args : WampusPublishArguments): Promise<any> {
        return this.publish$(args).toPromise();
    };

    private _embedStack(err: Error, callSites: CallSite[]) {

    }
}
