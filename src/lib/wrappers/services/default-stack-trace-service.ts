import {StackTraceService} from "../services";
import CallSite = NodeJS.CallSite;

export const defaultStackService: StackTraceService = {
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
            let {stack, err} = obj.stack as any;
            Error.prepareStackTrace = origTrace;
            return stack;
        }
        return null;
    },
    enabled : true
};