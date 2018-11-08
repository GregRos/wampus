import {
	AbstractWampusSessionServices,
	JsonToRuntimeObject,
	RuntimeErrorToResponse,
	RuntimeObjectToJson, TransformSet
} from "../services";
import {WampUri} from "../../core/protocol/uris";
import _ = require("lodash");
import CallSite = NodeJS.CallSite;
import {TransformStep} from "./recursive-transform";
import {CallTicket} from "../tickets/call";

export const createDefaultServices = () => {
	let s = {
		transforms : new TransformSet(),
		stackTraceService : {
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
		}
	} as AbstractWampusSessionServices;
	let x = s.transforms;

	x.jsonToObject.add((x,ctrl) => {
		if (!x || typeof x !== "object") return x;
		if (Array.isArray(x)) {
			return x.map(x => ctrl.recurse(x));
		}
		let res = _.mapValues(x, v => ctrl.recurse(v));
		return res;
	});

	x.objectToJson.add((x,ctrl) => {
		if (!x || typeof x !== "object") return x;
		if (Array.isArray(x)) {
			return x.map(x => ctrl.recurse(x));
		}
		let res = _.mapValues(x, v => ctrl.recurse(v));
		return res;
	});

	x.errorToErrorResponse.add(({error, source}, ctrl) => {
		let err = error;
		if (s.stackTraceService.enabled) {
			err.stack = err.stack + "\n(Wampus Registered At)" + s.stackTraceService.format("" as any, source.source.trace.created);
		}
		return {
			args: [],
			error: WampUri.Error.RuntimeError,
			options: {
				message: err.message
			},
			kwargs: _.pick(err, ["message", "name", "stack"])
		};
	});

	x.errorResponseToError.add((err, ctrl) => {
		return err;
	});

	return s;
};