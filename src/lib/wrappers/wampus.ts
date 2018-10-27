import {HelloDetails} from "../core/protocol/options";
import {WampusSession} from "./wampus-session";
import {TransportFactory, WampusCoreSession} from "../core/session/core-session";
import {AuthenticationWorkflow} from "../core/session/authentication";
import {Serializer} from "../core/serializer/serializer";
import {WampMessage} from "../core/protocol/messages";
import Unknown = WampMessage.Unknown;
import {WebsocketTransport} from "../core/transport/websocket";
import {JsonSerializer} from "../core/serializer/json";
import {AbstractWampusSessionServices, StackTraceService, TransformSet} from "./services";
import {DependencyDeclarations} from "./dependency-declarations";
import {NewObjectInitializer} from "../common";


export type SerializerDeclaration = "json" | Serializer;

export interface WebsocketTransportConfig {
    type : "websocket";
    url : string;
    serializer : SerializerDeclaration;
    timeout ?: number;
}

export interface UnknownTransportConfig {
    type : "unknown";
}


export type TransportDeclaration = TransportFactory | WebsocketTransportConfig | UnknownTransportConfig

export interface WampusConfig {
    realm : string;
    timeout ?: number;
    helloDetails?: NewObjectInitializer<HelloDetails>;
    authenticator ?: AuthenticationWorkflow;
    transport : TransportDeclaration;
    services?: NewObjectInitializer<AbstractWampusSessionServices>
}

export module Wampus {
    export async function create(config : WampusConfig) {
        let transportFactory= DependencyDeclarations.transport(config.transport);
        let coreSession = await WampusCoreSession.create({
            helloDetails : config.helloDetails,
            authenticator : config.authenticator,
            timeout : config.timeout,
            transport : transportFactory,
            realm : config.realm
        });
        return new WampusSession(coreSession, config.services);
    }
}