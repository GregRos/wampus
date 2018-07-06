# Wampus.js

Currently under early development.

Wampus.js will be a JavaScript client for the WAMP protocol. The WAMP protocol is a protocol that allows peer-to-peer RPC and PubSub-type communication between different nodes connected to the same server.

The goal of Wampus is to provide a full client library for the WAMP protocol, as well as to better integrate WAMP communication into the language and the environment, using modern ES6+ features such as async functions, built-in Promises, Observables, etc. without sacrificing the cross-platform and language-agnostic nature of the WAMP protocol.

## Wampus feature list

Note that this is basically a wish list. It doesn't work yet.

1. Accurate implementation of the WAMP protocol, including responding to protocol violations, to make sure the connection is reliable.

2. Support for all/most alpha+ advanced profile features.

3. High performance.

4. Platform-agonstic (runs on Node.js and browser)

5. Observable-based API, but with promise- and event- based APIs for compatibility with existing code/mindsets, and in some cases conciseness. Observable implementation will be `must.js` for now, but this might change.

7. Access to both a higher-level invocation-based API (e.g. `session.call("name")`) and a lower-level message-passing API (e.g. `session.proto.send(craftedMessage)`) with varying levels of abstraction.

5. User-readable error messages for possible issues, protocol violations, connection errors, etc.

6. Support for serializing/deserializing data into desired formats. E.g. receive a JSON-encoded object graph, turn into JS complex nested object.

7. Lower-level access to a message sending API for integration with custom protocol implementations and using experimental features.