import {AbstractWampusSessionServices} from "../services";
import {WampUri} from "../../core/protocol/uris";
import _ = require("lodash");
import CallSite = NodeJS.CallSite;

export function defaultServices() {
	let services  = {} as unknown as AbstractWampusSessionServices;
	services.transforms = {
		errorResponseToError(call, res) {
			return res;
		},
		objectToJson(obj) {
			return _.clone(obj);
		},
		errorToErrorResponse(source, err) {
			if (services.stackTraceService.enabled) {
				err.stack = err.stack + "\n(Wampus Registered At)" + services.stackTraceService.format("" as any, source.source.trace.created);
			}
			return {
				args: [],
				error: WampUri.Error.RuntimeError,
				options: {
					message: err.message
				},
				kwargs: _.pick(err, ["message", "name", "stack"])
			};
		},
		jsonToObject(js) {
			return js;
		}
	};
	services.stackTraceService = {
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

	return services;
}