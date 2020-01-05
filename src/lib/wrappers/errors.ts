import {WampusInvalidArgument} from "../core/errors/types";

/* tslint:disable:completed-docs */

/**
 * Common errors used by the library that are
 */
export namespace Errors {

    export function unknownEvent(name: string) {
        return new Error(`Unknown event name ${name}.`);
    }

    export namespace Creation {
        export function unknownSerializerName(object: any) {
            return new WampusInvalidArgument("Unknown serializer name '{name}'.", {
                name: object
            });
        }

        export function unknownSerializer(object: any) {
            return new WampusInvalidArgument("Given invalid serializer.", {});
        }

        export function unknownTransportName(object) {
            return new WampusInvalidArgument("Unknown transport name '{name}'.", {
                name: object
            });
        }

        export function unknownTransport(object) {
            return new WampusInvalidArgument("Given invalid transport.", {});
        }
    }
}

