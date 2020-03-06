# Wampus.js
[![Build Status](https://travis-ci.org/GregRos/wampus.svg?branch=master)](https://travis-ci.org/GregRos/wampus)
[![codecov](https://codecov.io/gh/GregRos/wampus/branch/master/graph/badge.svg)](https://codecov.io/gh/GregRos/wampus)
[![npm version](https://badge.fury.io/js/wampus.svg)](https://badge.fury.io/js/wampus)

Wampus.js is a JavaScript client for the WAMP protocol. The WAMP protocol is a protocol that allows peer-to-peer RPC and PubSub-type communication between different nodes connected to the same server.

For more information about the WAMP protocol, see **[The official WAMP website](https://wamp-proto.org/)**. 

Other examples of WAMP protocol clients:

* [Autobahn|JS](https://github.com/crossbario/autobahn-js), which convinced me to write my own client.
* [others...](https://wamp-proto.org/implementations/index.html)

Wampus is currently a Node-only  client, but it will work on browsers in the future.

## Installation

```bash
npm install wampus rxjs@^6.3.3 typed-wamp
```

or:

```bash
yarn add wampus rxjs@^6.3.3 typed-wamp
```

## Features

✓ Accurate implementation of the WAMP protocol.

✓ Observable- and Promise- based API, using `rxjs`.

✓ Primary high-level invocation-based API (e.g. `session.call("name")`).

✓ Secondary low-level message-passing API (e.g. `session.protocol.send(craftedMessage)`) with varying levels of abstraction.

✓  Support for all/most alpha+ advanced profile features.

✓ Human-readable error messages.

✓ Secondary callback-based API for callers unused to observables.

✓ Intelligent stack trace collection.

✓  Support for reviving simple JSON into complex objects and vice versa.

## Connecting

To connect to a router use the `connect` method, where you can specify the transport (which includes the type, address, etc)

```typescript
import {Wampus} from "wampus";
let session = Wampus.connect({
    // transport - required
    transport : {
        type : "websocket",
        url : "ws://localhost:8080",
        // serializer - required
        serializer : "json"
    },
    // realm - required
    realm : "my_realm"
})
```

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

You register procedures using the `.procedure` method:

```typescript
let registrationTicket = await session.procedure({
    name : "wampus.examples.register",
    options : {
        // any protocol options
    },
    async called(invocationTicket) {
        return {
            args : [1, 2]
        }
    }
});
```

Note that the method returns a promise, and to receive the actual ticket, you must `await` it.

As part of the method, you supply an `called` function which is called whenever the procedure is invoked.

The function receives an `InvocationTicket`, which is another type of ticket that contains the invocation info and lets you send progress reports and check if the caller requested cancellation.

The invocation function, called the `ProcedureHandler`, returns a promise with the final result of the invocation. The function must yield a result of the form:

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
let registrationTicket = await session.procedure({
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

## Debugging

Wampus uses a rich system of error objects that are extremely helpful when debugging. 

Wampus code should always throw errors that extend `WampusError`. Specific error classes depend on the situation, and include:

1. `WampusInvocationError` -  Thrown when a callee responds to an RPC call with an error response.
2. `WampusIllegalOperationError` - Thrown when a WAMP operation, such as a call, registration, subscription, etc, failed because it was illegal.
3. `WampusNetworkError` - Thrown when the underlying transport errors or when there is a WAMP protocol failure.
4. `WampusInvocationCancelledError` - Thrown by code waiting for a cancelled invocation to complete.

Error objects can have additional properties that contain more information on the error. Errors that are caused by WAMP messages will have properties such as `args`, `kwargs`, etc. 

## Protocol constraints

This section is necessary in order to put some of Wampus's features in context, and also to show how the constraints of the WAMP protocol affect the way you write your software. It also shows you how Wampus services deal with these constraints.

This section isn't meant to be a complete guide to the protocol, just to highlight some things and how they influence the library.

### The format of data messages

Most data messages in the WAMP protocol have the following fields:

```
{
    args ?: any[];
    kwargs ?: any;
    options ?: OperationSpecificOptions;
}
```

This format appears in:

1. Procedure returns (output)
2. Procedure arguments (input)

So both returns and arguments can have multiple positional values, as well as one set of keyed values.

Procedures that return successfully MUST reply with a message in this format. That means you can't just return `4`, `undefined`, an array, etc. As a consequence of this, a WAMP procedure cannot return nothing. The closest you can come to that is returning an empty object, `{}`.

It's not possible to automatically convert from JavaScript's single return value (output) and positional arguments (input) into this format, and Wampus doesn't try to do this. Instead, you'll have to send and receive data in this format yourself.

However, Wampus does transform the contents of data messages when they are received and sent. The central idea is to allow you to control how complex objects are flattened, and how flat JSON is revived into a complex object.

The way it does this is pretty interesting and appears in a later section.

### The format of error messages

WAMP also has a format for error messages sent by invocations. 

```
{
    args ?: any[];
    kwargs ?: any[];
    details ?: any;
    error : string;
}
```

In this case, `error` contains the name of the error, typically in WAMP naming convention, such as `application.error.no_id_found`. This field can also contain protocol errors such as `wamp.error.no_such_realm`, which are sent by the router and not the callee. 

`args` and `kwargs` serve the same purpose as in the data message format.

`details` is another field that can contain an informational object, just like `kwargs`. 

Wampus lets you revive error responses into full Error objects, and vice versa, using the same type of transformation that's used for the contents of data messages.

## Transform Service

Wampus uses [transcurse](https://github.com/GregRos/transcurse), a recursive transformation library, for processing inputs and outputs. Four different transformations are defined:

1. Objects received via args and kwargs, via `in.json`
2. WAMP error responses, to instances of `Error`, via `in.error`
3. Objects sent via args and kwargs, via `out.json`
4. Error objects to WAMP error responses, via `out.error`.

You can modify the existing transformations by modifying the services.

```typescript
const conn = await Wampus.connect({
    //...
    services(svcs) {
        svcs.out.json = svcs.out.json.pre(ctrl => {
            //...
        })
    }
})
```



### How it works



## Stack trace service

Due to the asynchronous nature of WAMP, there is no stack trace information linking a WAMP message being sent and a WAMP error being received in response to that message.

In addition, because Wampus heavily uses rxjs, stack traces will tend to be full of rxjs code and little else. This makes such calls hard to debug.

The stack trace service is an optional service that captures stack traces when an asynchronous call is made and embeds the stack trace into errors thrown as a result of that code. This makes debugging somewhat easier.

The default stack trace service uses the V8 stack trace API, and so only works in environments that use V8. In other environments, you will need to implement your own stack trace service.

The stack trace service looks like this:

```
{
    capture(ctor : Function) : CallSite[];
    format(err : Error, callSites : CallSite[]) : string;
    enabled : boolean;
}
```

You can modify the stack trace service by overwriting it or parts of it in the service initializer:

```typescript
let x = Wampus.connect({
    //...
    services(svcs) {
        svcs.stackTraceService = {
            // my service
        }
        
    }
})
```

You can also just disable it by setting `stackTraceService.enabled = false`.

## Advanced profile support

Wampus supports most alpha+ advanced profile features. Here is the breakdown:

| RPC Feature                | Supported | Support Info                                   |
| -------------------------- | --------- | ---------------------------------------------- |
| progressive_call_results   | ✓         |                                                |
| progressive_calls          | (Sketch)  |                                                |
| call_timeout               | ✓         | Depends on the callee checking cancel requests |
| call_canceling             | ✓         |                                                |
| caller_identification      | ✓         | No special implementation needed               |
| call_trustlevels           | ✓         | No special implementation needed               |
| registration_meta_api      | ✓         | No special implementation needed               |
| pattern_based_registration | ✓         | No special implementation needed               |
| shared_registration        | ✓         | No special implementation needed               |
| sharded_registration       | (Sketch)  |                                                |
| registration_revocation    | (Sketch)  |                                                |
| procedure_reflection       | (Sketch)  |                                                |

| PubSub Feature                | Supported | Support Info                     |
| ----------------------------- | --------- | -------------------------------- |
| subscriber_blackwhite_listing | ✓         | No special implementation needed |
| publisher_exclusion           | ✓         | No special implementation needed |
| publisher_identification      | ✓         | No special implementation needed |
| publication_trustlevels       | ✓         | No special implementation needed |
| subscription_meta_api         | ✓         | No special implementation needed |
| pattern_based_subscription    | ✓         | No special implementation needed |
| sharded_subscription          | (Sketch)  |                                  |
| event_history                 | ✓         | No special implementation needed |
| topic_reflection              | (Sketch)  |                                  |

| Other Feature                     | Supported | Support Info                                                 |
| --------------------------------- | --------- | ------------------------------------------------------------ |
| challenge-response authentication | ✓         | No authentication method is built-in, so challenge response must be done manually by the client. |
| cookie authentication             | ✗         | Must be manually performed by the user                       |
| ticket authentication             | ✗         | Must be manually performed by the user                       |
| rawsocket transport               | ✗         | Currently only WS transport is supported                     |
| batched WS transport              | (Sketch)  |                                                              |
| longpoll transport                | ✗         | Currently only WS transport is supported                     |
| session meta api                  | ✓         | No special implementation needed                             |
| MessagePack serialization         | ✗         | Only JSON serialization is implemented                       |

## Comments

Originally, this library was supposed to have an API completely based around cold observables. For example, using `call` would return an observable that performs the call when subscribed to. Unsubscribing would cancel the call.

However, I had to abandon this design due to technical limitations.	