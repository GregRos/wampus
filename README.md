# Wampus.js
[![Build Status](https://travis-ci.org/GregRos/wampus.svg?branch=master)](https://travis-ci.org/GregRos/wampus)
[![codecov](https://codecov.io/gh/GregRos/wampus/branch/master/graph/badge.svg)](https://codecov.io/gh/GregRos/wampus)
[![npm version](https://badge.fury.io/js/wampus.svg)](https://badge.fury.io/js/wampus)

Currently under development.

Wampus.js is a JavaScript client for the WAMP protocol. The WAMP protocol is a protocol that allows peer-to-peer RPC and PubSub-type communication between different nodes connected to the same server.

For more information about the WAMP protocol, see **[The official WAMP website](https://wamp-proto.org/)**. 

Other examples of WAMP protocol clients:

* [Autobahn|JS](https://github.com/crossbario/autobahn-js), which convinced me to write my own client.
* [others...](https://wamp-proto.org/implementations/index.html)

## Features

✓ Accurate implementation of the WAMP protocol.

✓ Observable- and Promise- based API, using `rxjs`.

✓ Primary high-level invocation-based API (e.g. `session.call("name")`).

✓ Secondary low-level message-passing API (e.g. `session.protocol.send(craftedMessage)`) with varying levels of abstraction.

✓  Support for all/most alpha+ advanced profile features.

✓ Human-readable error messages.

**(Untested)** Secondary callback-based API for callers unused to observables.

**(Untested)** Intelligent stack trace collection.

**(Untested)** Respond to protocol violations per spec (i.e. ABORT connection)

**(Untested)**  Support for reviving simple JSON into complex objects and vice versa.

Currently, the finer points of the API need to be ironed out and a lot of the wrapping API code needs to be tested.

Although high-performance and portability are a goal, no work has been done on those things yet.

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

## Debugging

Wampus uses a rich system of error objects that are extremely helpful when debugging. 

Wampus code should always throw errors that extend `WampusError`. Specific error classes depend on the situation, and include:

1. `WampusInvocationError` -  Thrown when a callee responds to an RPC call with an error response.
2. `WampusIllegalOperationError` - Thrown when a WAMP operation, such as a call, registration, subscription, etc, failed because it was illegal.
3. `WampusNetworkError` - Thrown when the underlying transport errors or when there is a WAMP protocol failure.
4. `WampusInvocationCancelledError` - Thrown by code waiting for a cancelled invocation to complete.

Error objects can have additional properties that contain more information on the error. Errors that are caused by WAMP messages will have properties such as `args`, `kwargs`, etc. 

## Protocol constraints and Wampus services

This section is necessary in order to put some of Wampus's features in context, and also to show how the constraints of the WAMP protocol affect the way you write your software. It also shows you how Wampus services deal with these constraints.

This section isn't meant to be a complete guide to the protocol, just to highlight some things and how they influence the library.

### The format of data messages

Messages in the WAMP protocol have the following customizable fields (note that this is NOT how they are actually serialized):

```
{
    args ?: any[];
    kwargs ?: any[];
    options ?: OperationSpecificOptions;
}
```

The `options` field can sometimes be called `details`.

Procedures that return successfully MUST reply with a message in this format. That means you can't just return `4`, `undefined`, an array, etc. As a consequence of this, a WAMP procedure cannot return nothing. The closest you can come to that is returning an empty object, `{}`.

When you make a call using WAMP, you also send data in this format as the argument. Once again, you can't just send `null` as an argument. 

Note that there are two (sometimes three) ways to send data in the WAMP protocol: `args`, which sends a number of arguments in order, and `kwargs`, which is supposed to be for sending named arguments.  `options` is reserved for protocol options.

This makes things a bit confusing, especially if you opt to use both systems. 

Regardless, this makes it impossible to simply convert a single return value into a WAMP return response, since there are many ways to do it. For this reason, whenever you call a WAMP procedure or return a value from one, you'll need to use the WAMP data message format. 

#### Transforming data

Although Wampus does NOT transform WAMP data messages into single objects or lists of objects, and you have to return and receive data in WAMP format yourself, it does transform objects that you send using data fields, such as the contents of `args` and `kwargs`. 

By default, only the own, enumerable properties of an object will be stringified by `JSON.stringify` and similar functions. This is unsuitable when working with complex objects, some of which inherit important properties from their parents (including getters and setters), and may contain important non-enumerable properties.

For this reason, Wampus provides transformations that are applied to objects before they are sent via WAMP and after they are received via WAMP, in order to flatten or enrich them.

```typescript
let session = Wampus.create({
    services(svcs) {
        // svcs is the default services object
        svcs.transforms.jsonToObject = (flatObject) => {
            // We receive a flat object and return a complex one.
        };
        svcs.transforms.objectToJson = (complexObject) => {
            // We receive a complex object and return a flat one.
        }
    })
})
```

These transformations are part of the configurable *services* defined when the session is created.

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

Once again, this special format makes it impossible to directly convert JavaScript errors from and to WAMP error responses. Unlike return values, Wampus does not expect you to throw special exceptions in order to serialize them. You can throw regular exceptions, and they will be transformed to error responses.

#### Transforming errors

Wampus uses `errorToErrorResponse` and `errorResponseToError` in order to convert between error responses and full JavaScript errors. These configurable services are defined when the session is created, just like json-to-object transformations.

By default, an error response will be converted into a `WampusInvocationError`, which has the error response fields as properties.

Error objects are converted into error responses by serializing them (using `transforms.objectToJson`) and embedding the result in the `kwargs` field. The `error` field is set to the default `wamp.error.runtime_error`.

### Stack trace service

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

## Advanced profile support

Wampus supports most alpha+ advanced profile features. Here is the breakdown:

| RPC Feature                | Supported | Support Info                                   |
| -------------------------- | --------- | ---------------------------------------------- |
| progressive_call_results   | ✓         |                                                |
| progressive_calls          | ✗         | Sketch only                                    |
| call_timeout               | ✓         | Depends on the callee checking cancel requests |
| call_canceling             | ✓         |                                                |
| caller_identification      | ✓*        | No special implementation needed               |
| call_trustlevels           | ✓*        | No special implementation needed               |
| registration_meta_api      | ✓*        | No special implementation needed               |
| pattern_based_registration | ✓*        | No special implementation needed               |
| shared_registration        | ✓*        | No special implementation needed               |
| sharded_registration       | ✗         | (Sketch)                                       |
| registration_revocation    | ✗         | (Sketch)                                       |
| procedure_reflection       | ✗         | (Sketch)                                       |

| PubSub Feature                | Supported | Support Info                     |
| ----------------------------- | --------- | -------------------------------- |
| subscriber_blackwhite_listing | ✓*        | No special implementation needed |
| publisher_exclusion           | ✓*        | No special implementation needed |
| publisher_identification      | ✓*        | No special implementation needed |
| publication_trustlevels       | ✓*        | No special implementation needed |
| subscription_meta_api         | ✓*        | No special implementation needed |
| pattern_based_subscription    | ✓*        | No special implementation needed |
| sharded_subscription          | ✗         | (Sketch)                         |
| event_history                 | ✓*        | No special implementation needed |
| topic_reflection              | ✗         | (Sketch)                         |

| Other Feature                     | Supported | Support Info                                                 |
| --------------------------------- | --------- | ------------------------------------------------------------ |
| challenge-response authentication | ✓         | No authentication method is built-in, so challenge response must be done manually by the client. |
| cookie authentication             | ✗         | Must be manually performed by the user                       |
| ticket authentication             | ✗         | Must be manually performed by the user                       |
| rawsocket transport               | ✗         | Currently only WS transport is supported                     |
| batched WS transport              | ✗         | (Sketch)                                                     |
| longpoll transport                | ✗         | Currently only WS transport is supported                     |
| session meta api                  | ✓*        | No special implementation needed                             |
| MessagePack serialization         | ✗         | Only JSON serialization is implemented                       |

## Comments

Originally, this library was supposed to have an API completely based around cold observables. For example, using `call` would return an observable that performs the call when subscribed to. Unsubscribing would cancel the call.

However, I had to abandon this design due to technical limitations.