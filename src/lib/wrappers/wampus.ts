import {HelloDetails} from "../core/protocol/options";
import {WampusSession} from "./wampus-session";
import {WampusCoreSession} from "../core/session/core-session";
import {AuthenticatorFunction} from "../core/session/authentication";
import {WampMessage} from "../core/protocol/messages";
import {AbstractWampusSessionServices} from "./services";
import {DependencyDeclarations, TransportDeclaration} from "./dependency-selector";
import {NewObjectInitializer} from "../common/common";


export interface WampusConfig {
    realm : string;
    timeout ?: number;
    helloDetails?(dits : HelloDetails) : void;
    authenticator ?: AuthenticatorFunction;
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