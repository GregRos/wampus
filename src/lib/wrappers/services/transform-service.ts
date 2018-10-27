import {WampUri} from "../../core/protocol/uris";
import {TransformSet} from "../services";
import _ = require("lodash");

export const defaultTransformSet: TransformSet = {
    errorResponseToError(services, call, res) {
        return res;
    },
    objectToJson(services,obj) {
        return _.clone(obj);
    },
    errorToErrorResponse(services, source, err) {
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
    jsonToObject(services, js) {
        return js;
    }
};