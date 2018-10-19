import {HelloDetails} from "../core/protocol/options";
import {WampusSession} from "./wampus-session";
import {TransportFactory, WampusCoreSession} from "../core/session/core-session";
import {AuthenticationWorkflow} from "../core/session/authentication";
import {Serializer} from "../core/serializer/serializer";
import {WampMessage} from "../core/protocol/messages";
import Unknown = WampMessage.Unknown;
import {WebsocketTransport} from "../core/transport/websocket";
import {JsonSerializer} from "../core/serializer/json";
import {StackTraceService, TransformSet} from "./services";



export interface WebsocketTransportConfig {
    type : "websocket";
    url : string;
    serializer : Serializer | "json";
    timeout ?: number;
}

export interface UnknownTransportConfig {
    type : "unknown";
}

export interface WampusConfig {
    realm : string;
    timeout ?: number;
    helloDetails?(details : HelloDetails) : HelloDetails;
    authenticator ?: AuthenticationWorkflow;
    transport : TransportFactory | WebsocketTransportConfig | UnknownTransportConfig;
    stackTraceService ?: StackTraceService;
    transforms ?: TransformSet;
}

export module Wampus {
    export async function create(config : WampusConfig) {
        let transportFactory : TransportFactory;
        if (typeof config.transport === "function" ){
            transportFactory = config.transport;
        }
        else if (config.transport.type === "websocket") {
            let transportData = config.transport;

            let serializer : Serializer;
            if (config.transport.serializer === "json") {
                serializer = new JsonSerializer();
            } else {
                serializer = config.transport.serializer;
            }
            transportFactory = () => {
                return WebsocketTransport.create({
                    serializer : serializer,
                    timeout : transportData.timeout,
                    url : transportData.url,
                });
            }
        }
        let coreSession = await WampusCoreSession.create({
            helloDetails : config.helloDetails,
            authenticator : config.authenticator,
            timeout : config.timeout,
            transport : transportFactory,
            realm : config.realm
        });
        return new WampusSession(coreSession, {
            transforms : config.transforms,
            stackTraceService : config.stackTraceService
        });
    }
}