# Wampus.js

Currently under early development.

Wampus.js is a JavaScript client for the WAMP protocol. The WAMP protocol is a protocol that allows peer-to-peer RPC and PubSub-type communication between different nodes connected to the same server.

The goal of Wampus is to provide a full client library for the WAMP protocol, as well as to better integrate WAMP communication into the language and the environment, using modern ES6+ features such as async functions, built-in Promises, Observables, etc. without sacrificing the cross-platform and language-agnostic nature of the WAMP protocol.

## Differences from `Autobahn` and other clients

1. Fully Promise- and async-aware API, without unnecessary callbacks in odd places.

2. For cases where async functions don't make sense:

    1. Support standard JS event mechanisms  to allow integration with current JS code. 
    2. But also expose a high-performance Observable interface using a library such as `must.js`.

3. Customizable error handling that works well with other JavaScript code. You don't need to throw special library-specific exceptions or (ugh) arrays or something.

4. Customizable serialization logic.

5. User-readable error messages for possible issues, protocol violations, connection errors, etc.

6. Lower-level access to a message sending API for integration with custom protocol implementations and using experimental features.