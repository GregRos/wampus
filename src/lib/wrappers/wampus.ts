import {HelloDetails} from "../core/protocol/options";
import {WampusSession} from "./wampus-session";
import {WampusCoreSession} from "../core/session/core-session";
import {AuthenticatorFunction} from "../core/session/authentication";
import {AbstractWampusSessionServices} from "./services";
import {DependencyDeclarations} from "./dependency-selector";
import {NewObjectInitializer} from "../common/common";
import {Serializer} from "../core/serializer/serializer";
import {TransportFactory} from "../core/transport/transport";

/**
 * Declares the serializer to use.
 */
export type SerializerDeclaration = "json" | Serializer;

export interface WebsocketTransportConfig {
	type: "websocket";
	url: string;
	serializer: SerializerDeclaration;
	timeout?: number;
}

export interface UnknownTransportConfig {
	type: "unknown";
}

export type TransportDeclaration = TransportFactory | WebsocketTransportConfig | UnknownTransportConfig

/**
 * Specifies the transport, realm, authenticator, and services for use by a Wampus session.
 */
export interface WampusConfig {
	/**
	 * An object describing what transport to use, or a factory for transport objects.
	 */
	transport : TransportDeclaration;
	/**
	 * The realm to join.
	 */
    realm : string;
	/**
	 * A timeout value used for waiting for protocol messages from the router.
	 */
	timeout ?: number;
	/**
	 * An initializer that lets you configure the HELLO message sent to the router.
	 */
	handshake ?: NewObjectInitializer<HelloDetails>;
	/**
	 * You must provide this function if you want to use some form of authentication.
	 */
    authenticator ?: AuthenticatorFunction;
	/**
	 * A set of services that provide additional functionalty to the session.
	 */
	services?: NewObjectInitializer<AbstractWampusSessionServices>
}

/**
 * Creates Wampus sessions.
 */
export module Wampus {
    export async function connect(config : WampusConfig) {
        let transportFactory= DependencyDeclarations.transport(config.transport);
        let coreSession = await WampusCoreSession.create({
            helloDetails : config.handshake,
            authenticator : config.authenticator,
            timeout : config.timeout,
            transport : transportFactory,
            realm : config.realm
        });
        return new WampusSession(coreSession, config.services);
    }
}