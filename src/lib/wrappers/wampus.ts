import {HelloDetails} from "../core/protocol/options";
import {WampusSession} from "./wampus-session";
import {WampusCoreSession} from "../core/session/core-session";
import {AuthenticatorFunction} from "../core/session/authentication";
import {WampMessage} from "../core/protocol/messages";
import {AbstractWampusSessionServices} from "./services";
import {DependencyDeclarations, TransportDeclaration} from "./dependency-selector";
import {NewObjectInitializer} from "../common/common";


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