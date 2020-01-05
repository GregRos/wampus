import {AbstractWampusSessionServices, TransformSet} from "../services";
import {WampUri} from "typed-wamp";
import {WampusInvocationCanceledError} from "../../core/errors/types";
import {mapValues, pick} from "lodash";
import CallSite = NodeJS.CallSite;

export const createDefaultServices = () => {
    let s = {
        transforms: new TransformSet(),
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
    let x = s.transforms;

    x.jsonToObject.add((x, ctrl) => {
        if (!x || typeof x !== "object") return x;
        if (Array.isArray(x)) {
            return x.map(x => ctrl.recurse(x));
        }
        let res = mapValues(x, v => ctrl.recurse(v));
        return res;
    });

    x.objectToJson.add((x, ctrl) => {
        if (!x || typeof x !== "object") return x;
        if (Array.isArray(x)) {
            return x.map(x => ctrl.recurse(x));
        }
        let res = mapValues(x, v => ctrl.recurse(v));
        return res;
    });

    x.errorToErrorResponse.add((err, ctrl) => {
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

    x.errorResponseToError.add((err, ctrl) => {
        return err;
    });

    return s;
};