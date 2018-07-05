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

##  API sketch 

Teh core API will heavily use Observables, because they are functionality-rich and can be used as abstractions for different kinds of operations.

There will be another API that works with events and promises.

ALL observables used in the API are COLD. They don't do anything until you subscribe to them, and then they send the message they're designed to. That means if you use the same observable more than once when composing, you can end up subscribing to them more than once and sending more than one message.

This also means that the same observable will complete differently for different subscribers.

### Calling Procedures
RPC calls will return an observable. Subscribing to the observable will send a call to the procedure. When the call is finished, the observable will emit the returned value and complete.

The observable will error if:

1. An exception is thrown on the callee's side, or more technically, the call completes with an error response.
2. The router refuses to make the call, such as due to security reasons or because the procedure doesn't exist.
3. A transport-level error occurs.

#### Progress reporting
If the call is made with progress reporting enabled, objects of the form `{type : "return", ...}` and `{type: "progress", ...}` will be emitted. Progress-type objects may be emitted several times before the return-type object is emitted and the observable completes.

#### Unsubscribe and cancellation
When the subscription to the observable is closed, the call made as part of the subscription may be cancelled if it's possible. There is no dedicated way, other than closing the subscription, of cancelling the call.

If the call message has already been sent, and the router supports cancellation, a cancel message will be sent. This may cause a cancellation message to be sent to the callee, if the callee supports cancellation.

#### Timeout

You can specify a timeout when you're making a call. If the router supports this feature, it will be included in the message. 

In any case, the observable will error when the time runs out and the result of the call will simply be discarded if the client receives it.

### Registration
When you registe a procedure, you need to supply a handler of the form:

    (x : Invocation) => Promise<any>

The handler is invoked every time a call to the procedure is made.

The `Invocation` object lets you access info about the call, as well as invoke advanced functionality:

1. Send a progress report, if the caller requested progress and the router supports it via `Invocation.progress(x)`.
2. Access the call arguments.
3. Inspect information about the call, such as `Invocation.details`.
4. Check if the call has been cancelled and if so, throw a special cancellation exception, `Invocation.checkCancel()`. This returns a `Promise<void>` and if the promise rejects, it means the call has been cancelled.

Registration returns a `Disposable` that you can close by calling `.dispose()`, which is an async operation.

### Publish
When you publish, you call:

    let publisher = session.publisher(options, "blah");

This gives you an object with a `publish` method that you can use to publish events of that type with those options.

    publisher.publish({...});
    

### Subscribe
Call `.event("name", options)`. This gives you an observable. Once you subscribe to the observaboe, a single subscription is made to the event via the router.

If the subscription fails, the observable will error.

The returned observable will never complete, and will emit a value every time an event is published. 

When the subscription is closed, the event is unsubscribed.

