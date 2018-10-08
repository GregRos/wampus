# Wampus.js

Currently under development.

Wampus.js will be a JavaScript client for the WAMP protocol. The WAMP protocol is a protocol that allows peer-to-peer RPC and PubSub-type communication between different nodes connected to the same server.

The goal of Wampus is to provide a full client library for the WAMP protocol, as well as to better integrate WAMP communication into the language and the environment, using modern ES6+ features such as async functions, built-in Promises, Observables, etc. without sacrificing the cross-platform and language-agnostic nature of the WAMP protocol.

## Wampus feature list

Most of these are implemented, but the library hasn't been tested (read - *don't use this yet*)

1. Accurate implementation of the WAMP protocol.

1. Observable- and Promise- based API, using `rxjs`.

1. Primary high-level invocation-based API (e.g. `session.call("name")`).

1. Secondary low-level message-passing API (e.g. `session.protocol.send(craftedMessage)`) with varying levels of abstraction.

1. Support for all/most alpha+ advanced profile features.

1. Human-readable error messages.

1. Intelligent stack trace collection and debugging.

1. Respond to protocol violations per spec (i.e. ABORT connection)

1. High performance.

1. Platform-agonstic (Node.js and browser)

7. Support for reviving simple JSON into complex objects and vice versa.

