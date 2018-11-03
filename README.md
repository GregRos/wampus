# Wampus.js
[![Build Status](https://travis-ci.org/GregRos/wampus.svg?branch=master)](https://travis-ci.org/GregRos/wampus)
[![codecov](https://codecov.io/gh/GregRos/wampus/branch/master/graph/badge.svg)](https://codecov.io/gh/GregRos/wampus)
[![npm version](https://badge.fury.io/js/wampus.svg)](https://badge.fury.io/js/wampus)

Currently under development.

Wampus.js will be a JavaScript client for the WAMP protocol. The WAMP protocol is a protocol that allows peer-to-peer RPC and PubSub-type communication between different nodes connected to the same server.

The goal of Wampus is to provide a full client library for the WAMP protocol, as well as to better integrate WAMP communication into the language and the environment, using modern ES6+ features such as async functions, built-in Promises, Observables, etc. without sacrificing the cross-platform and language-agnostic nature of the WAMP protocol.

## Current feature list

### Implemented
✓ Accurate implementation of the WAMP protocol.

✓ Observable- and Promise- based API, using `rxjs`.

✓ Secondary callback-based API for callers unused to observables.

✓ Primary high-level invocation-based API (e.g. `session.call("name")`).

✓ Secondary low-level message-passing API (e.g. `session.protocol.send(craftedMessage)`) with varying levels of abstraction.

✓  Support for all/most alpha+ advanced profile features.

### Partially implemented

**(?)** Human-readable error messages.

**(?)**  Intelligent stack trace collection.

**(?)** Respond to protocol violations per spec (i.e. ABORT connection)

**(?)**  Support for reviving simple JSON into complex objects and vice versa.

### Not implemented

* High performance.
* Platform-agonstic (Node.js and browser)

## Calling

Calling a WAMP procedure is pretty simple. Note that some of the properties are optional.

```typescript
let ticket = session.call({
    name : "wampus.examples.call",
    args : [1, 2, 3],
    kwargs : {
        dummy : "hello"
    },
    options : {
        // any special protocol options
    }
});
```

It should be noted that all calls made by Wampus support progress and cancellation by default. If you keep most of the options blank it looks like this:

```typescript
let ticket = session.call({name : "wampus.examples.call"});
```

The `CallTicket` object serves multiple purposes.

### Await final result

The object is promise-like and can be awaited to receive the final result. Note that you do not get progress reports this way (but an error will cause the promise to reject).

```typescript
let finalResult = await ticket;
```

It also exposes a regular promise via `ticket.result`:

```typescript
let finalResult = ticket.result;
```

### Progress reports

The object exposes the observable `.progress`, which yields all data messages (including the final message) and also errors.

```typescript
ticket.progress.subscribe(data => {
    if (data.isProgress) {
        console.log("Received progress", data);
    } else {
        console.log("Received final", data);
    }
}, err => {
    console.error("Received error", err);
})
```

You can also listen to progress reports via an event-like API:

```typescript
ticket.on("progress", data => {
    //... same
})
```

Note that unlike other methods, event listeners won't propagate errors, since they do not error.

### Cancellation

The call can be cancelled using the async`.close()` method:

```typescript
await ticket.close({
    mode : "kill"
});
```

This will send a cancellation request to the dealer. If the cancellation request is accepted, the call will error with a unique exception (`WampusInvocationCancelledError`).

### Static info

You can get info about the call using the call ticket.

```typescript
let {options, name, callId} = ticket.info;
```

## Registration

You register procedures using the `.register` method:

```typescript
let registrationTicket = await session.register({
    name : "wampus.examples.register",
    options : {
        // any protocol options
    },
    async invocation(invocationTicket) {
        return {
            args : [1, 2]
        }
    }
});
```

Note that the method returns a promise, and to receive the actual ticket, you must `await` it.

As part of the method, you supply an `invocation` function which is called whenever the procedure is invoked.

The function receives an `InvocationTicket`, which is another type of ticket that contains the invocation info and lets you send progress reports and check if the caller requested cancellation.

The invocation function, called the `ProcedureHandler`, is very flexible in terms of its return type. It can return:

1. A promise, making it async function.
2. An observable, with the initial values being progress reports.
3. A concrete value.

The function must always yield one or more values of the form:

```
{
    args ?: any[];
    kwargs ?: any;
    options ?: WampYieldOptions
}
```

(In WAMP, every procedure call has to return something, so the best approximation of returning void is returning `{}`).

### Progress reports

You can report progress by calling `invocationTicket.progress({})`. 

```typescript
let registrationTicket = await session.register({
    name : "wampus.examples.register",
    async invocation(invocationTicket) {
        // progress report 1
        await invocationTicket.progress({
            kwargs : {
                percent : 50
            }
        });
        // progress report 2
        await invocationTicket.progress({
            kwargs : {
                percent : 100
            }
        });
        // final result
        return {
            kwargs : {
                result : "hi!"
            }
        }
    }
});
```

You can also report progress by returning an observable from the invocation function. In this case, the last value will be considered to be a non-progress value.

You can also combine both technique, though this is not recommended as it's not possible to know which report will be sent before which.

### Cancellation

You can wait for cancellation using the `invocationTicket.waitForCancel(time)` function. This function lets you wait for a number of milliseconds for a cancellation request to arrive. If it arrives, the function returns a `CancellationTicket`.

```typescript
let cancellation = await invocationTicket.waitForCancel(100);
```

This tells you that cancellation has been requested, and also allows you to acknowledge the cancellation by calling `cancellation.throw()`, which throws a `WampusInvocationCancelledError`. Provided this error is not caught, it will cause the invocation to end with an error response indicating it has been cancelled.

```typescript
cancellation.throw(); // Throws a cancellation error
```

Note that if you do not use this method, you will need to manually throw a `WampusInvocationCancelledError` so that Wampus will know to respond to the invocation correctly.

### Closing the registration

You close a registration using the `await registrationTicket.close()` method. Closing a registration will still allow you to respond to outstanding invocations as far as Wampus is concerned. However, this matter isn't covered by the WAMP specification so it's implementation defined.

## Publishing

Publishing works similarly to the other options.

```typescript
await session.publish({
    name : "wampus.examples.publish",
    kwargs : {
        message : "published!"
    },
    options : {
        
    }
});
```

Unlike other methods, this method does not return any kind of ticket. 

It returns a promise which resolves immediately, or else once publication acknowledgement is received from the router (if the appropriate option is used).

## Subscribing

Subscribing to a topic uses the `.topic` method:

```typescript
let ticket = await session.topic({
    name : "wampus.examples.topic"
});
```

Events are sent via the `ticket.events` observable:

```typescript
ticket.events.subscribe(data => {
    console.log("received an event", data);
});
```

And the `"event"` event:

```typescript
ticket.on("event", data => {
    
});
```

### Unsubscribing

Note that each ticket is a single remote subscription, even though you can subscribe to the ticket's events multiple times. Calling `ticket.close()` will unsubscribe from the topic.

## Extra features - services

Wampus has a number of extra features designed to make WAMP easier to work with. These are called services and are configured when a session is created.

```typescript
let session = Wampus.create({
    services : (svcs => {
        svcs.transforms.jsonToObject = (x) => {
            
        }
    })
})
```



### Transformations

You can define a set of transformations on a session that let you customize how your objects are serialized into JSON, how JSON data is serialized into objects, and how errors are serialized and deserialized.

These transformations are set when the session is created, in the `services` key. This key shouldn't contain an object, but instead a function to transform the default set of services.

```typescript
let session = Wampus.create({
    services : svcs => {
        svcs.json
    }
})
```



#### JSON-to-object and vice versa

These functions are called when an object from outside needs to be turned into flat JSON and vice versa.

You can use them to revive JSON data as real objects, with a constructor and a prototype, and to change how complex objects are serialized.

##### Defaults

By default, JSON data is not transformed and objects are transformed into JSON by selecting only their own properties.

#### Error transforms

WAMP uses a very specific format for error responses that you can't generically map to JS exceptions.

One of the goals of Wampus was to avoid having to throw special exceptions in order to send proper error responses. So instead making sure your errors make sense to the caller is concentrated here.

The error-response-to-runtime-error transform receives a `WampusInvocationError` with WAMP error response data and should return a JavaScript exception. The opposite transform receives an arbitrary error and should return WAMP error data.

##### Defaults

By default, an error response will be converted into a `WampusInvocationError` and a runtime error will be serialized into an error response by embedding its own properties into the `kwargs` data field.

### Stack trace service

Due to the asynchronous nature of WAMP, there is no stack information linking an error response from the remote server and the call that caused that error response. This makes stack traces confusing and totally disconnected from their original cause.

To solve this, Wampus purposefully gathers stack info and embeds it into errors. To successfully do this, a stack trace gathering function is required.  

Gathering stack traces can also be somewhat expensive so you might want to turn it off.

#### Defaults

By default, the V8 stack trace API is used, but in other environments you will need to replace the service with something else.

# Errors

Wampus uses a rich system of error objects that are extremely helpful when debugging. 

Wampus code should always throw errors that extend `WampusError`. Specific error classes depend on the situation, and include:

1. `WampusInvocationError` -  Thrown when a callee responds to an RPC call with an error response.
2. `WampusIllegalOperationError` - Thrown when a WAMP operation, such as a call, registration, subscription, etc, failed because it was illegal.
3. `WampusNetworkError` - Thrown when the underlying transport errors or when there is a WAMP protocol failure.
4. `WampusInvocationCancelledError` - Thrown by code waiting for a cancelled invocation to complete.

Error objects can have additional properties that contain more information on the error. Errors that are caused by WAMP messages will have properties such as `args`, `kwargs`, etc. 