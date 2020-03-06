import {AbstractWampusSessionServices, createServices} from "../services";
import {WampUri} from "typed-wamp";
import {WampusInvocationCanceledError} from "../../core/errors/types";
import {pick} from "lodash";
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
                    let {stack} = obj.stack;
                    Error.prepareStackTrace = origTrace;
                    return stack;
                }
                return null;
            },
            enabled: true
        }
    } as AbstractWampusSessionServices;


    s.in.json = s.in.json.pre(Transcurses.structural);

    s.out.json = s.out.json.pre(Transcurses.structural);

    s.out.error = s.out.error.pre(ctrl => {
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

    return s;
};
