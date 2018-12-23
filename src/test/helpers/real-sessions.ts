import {Wampus, WampusConfig} from "../../lib";

let randomRealm = () => {
    return (Math.random() * 100000).toString(36);
};

export namespace RealSessions {
    export function session(stuff ?: Partial<WampusConfig>) {
        return Wampus.connect({
            realm: randomRealm(),
            transport: {
                type: "websocket",
                url: "ws://localhost:8080",
                serializer: "json"
            },
            ...(stuff || {})
        });
    }
}