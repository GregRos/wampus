import {AbstractWampusSessionServices, createServices, TransformSet} from "../services";
import {WampUri} from "typed-wamp";
import {WampusInvocationCanceledError} from "../../core/errors/types";
import {mapValues, pick} from "lodash";
import CallSite = NodeJS.CallSite;
import {Transcurses} from "transcurse";


export const createDefaultServices = () => {
    const svcs = createServices();
    let s = {
        ...svcs,
        stackTraceService: {
            format(err, cs: CallSite[]) {
                let formatter = Error.prepareStackTrace;
                if (!formatter) {
                    return cs.map(x => `   at ${x.getFunctionName()} (${x.getFileName()}:${x.getLineNumber()}:${x.getColumnNumber()}`).join("\n");
                } else {
                    return formatter.call(Error, err, cs);
                }
            },
            capture(ctor) {
                if ("stackTraceLimit" in Error) {
                    const origTrace = Error.prepareStackTrace;
                    Error.prepareStackTrace = (err, stack) => ({err, stack});
                    let obj = {stack: null};
                    Error.captureStackTrace(obj, ctor);
                    let {stack, err} = obj.stack;
                    Error.prepareStackTrace = origTrace;
                    return stack;
                }
                return null;
            },
            enabled: true
        }
    } as AbstractWampusSessionServices;



    s.out.error.pre(ctrl => {
        const err = ctrl.val;
        if (err instanceof WampusInvocationCanceledError) {
            return {
                error: WampUri.Error.Canceled,
                details: {
                    message: "Invocation cancelled"
                }
            };
        }
        return {
            args: [],
            error: WampUri.Error.RuntimeError,
            details: {
                message: err.message
            },
            kwargs: pick(err, ["message", "name", "stack", ...Object.keys(err)])
        };
    });

    s.in.error.pre(ctrl => {
        return ctrl.next();
    });

    return s;
};
