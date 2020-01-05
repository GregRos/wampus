import {TransportFactory} from "../core/transport/transport";
import {JsonSerializer} from "../core/serializer/json";
import {WebsocketTransport} from "../core/transport/websocket";
import {Errors} from "./errors";
import {SerializerDeclaration, TransportDeclaration} from "./wampus";

/**
 * Used to resolve transports and serializers based on keywords.
 * @private
 */
export namespace DependencyDeclarations {

    /**
     *
     * @param declr
     */
    export function serializer(declr: SerializerDeclaration) {
        if (declr === "json") {
            return new JsonSerializer();
        } else if (typeof declr.deserialize === "function") {
            return declr;
        } else {
            if (typeof declr === "string") {
                throw Errors.Creation.unknownSerializerName(declr);
            } else {
                throw Errors.Creation.unknownSerializer(declr);
            }
        }
    }

    export function transport(config: TransportDeclaration): TransportFactory {
        if (typeof config === "function") {
            return config;
        } else if (config.type === "websocket") {
            let transportData = config;

            let slzr = serializer(config.serializer);
            return () => {
                return WebsocketTransport.create({
                    serializer: slzr,
                    timeout: transportData.timeout,
                    url: transportData.url
                });
            };
        } else {
            if (typeof config.type === "string") {
                throw Errors.Creation.unknownTransportName(config.type);
            } else {
                throw Errors.Creation.unknownTransport(config);
            }
        }
    }
}