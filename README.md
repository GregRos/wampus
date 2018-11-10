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

Wampus uses a transformation system that lets you revive and flatten objects in a customizable, extensible, and powerful way.

### How it works

#### Step-by-step

Wampus uses a `StepByStepTransformer`, which has a list of `TransformStep` objects. Each `TransformStep` object is a function that you supply. Steps are executed in LIFO order, with each step being able to control how execution continues, in the manner described below.

This function looks like this:

```typescript
type TransformStep = (value : any, ctrl : TransformerControl) => any
```

The function takes two parameters, the value being transformed and a `TransformerControl` object. This object looks like this:

```typescript
type TransformerControl = {
    next(value : any) : any;
	recurse(value : any) : any;
}
```

Each transformation step should be seen as expecting some kind of data. For example, one step might transform a string into a date, another might transform a plain object into an instance of a class called `Person`, and so on.

The function `next` calls the next transform step in the list and returns whatever it returns. It's basically like saying "I can't handle this type of data, maybe the next transformation can." However, it also lets you change the value being transformed, and to modify the result before it's sent to the caller.

Here is an example of series of transformation steps and how `.next` is used to move between them:

```typescript
steps = [
    // It's helpful to name these steps, for debugging and informational purposes
    function parseStringIntoObject(x, ctrl) {
        // We only deal with strings in this step
        if (typeof x !== "string") return ctrl.next(x);
        
        // Try to parse this string
        if (someRegex.test(x)) {
            return new ParsedObject(x);
        }
        
        // This is a string we don't know how to parse, 
        // so let's yield to the next step:
        return ctrl.next(x);
    },
    
    // But you don't have to name them.
    (x, ctrl) => {
        // If the value is not an object, this step will ignore it:
        if (!x || typeof x !== "object") return ctrl.next(x);
        
        // This step looks for objects with type === "person"
        // and transforms them into instances of Person
        if (x.type === "person") {
            return new Person(x.firstName, x.lastName);
        }
        
        // If the data isn't of this type, then we can't handle it, 
        // let's try the next step
        return ctrl.next(x);
    },
]
```

Wampus will always have a final fallback transform step that will transform an object in a default way, so you don't have to write that code yourself every time. All you need to do is to yield execution to the next step until Wampus's transform is reached.

#### Recursion

Sometimes, you want to treat most of an object purely structurally (like flat JSON data), but there is one or more properties, somewhere deep inside the object, that need to be deserialized in a special way.

```typescript
{
    property1 : {
        property2 : [{
            // Supposed to be a date:
            date : {
                type : "date",
                value : "2018-11-07T21:51:42.767Z"
            },
            
            // Supposed to be a regex:
            regex :{
                type : "regex",
                value :  "[a-z]{3}-[0-9]{3}"
            },
        }]
    }
}
```

Somewhere deep inside these nested objects, is some value that you should transform. 

You deal with this structure using the `recurse` method. This method applies the whole sequence of transformation steps all over again, starting from the first one, on a new value. Normally, this will be the value of a key or an array element, but you can do weirder things too.

The benefit here over `next` is that `recurse` will apply all the steps before the current step, actually doing recursion (potentially infinitely, in fact). This is especially important in the default fallback step, because it has no next step, so it has to `recurse`.

Here is how a recursive step might recurse over the components of an object:

```typescript
function structuralStep(value : any, ctrl : TransformerControl) {
    // We don't yield to the next step, maybe because there is no next step
	if (!value || typeof value !== "object") return value;
	
    // For arrays, recursively transform each element separately:
    if (Array.isArray(value)) {
        return value.map(x => ctrl.recurse(x));
    }
    
    let clone = {};
    
    // For objects, recursively transform each property value
    for (let k of Object.keys(value)) {
        clone[k] = ctrl.recurse(value[k]);
    }
    return clone;
}
```

`recurse` can cause infinite recursion, like any other form of recursion. Wampus protects against this by making sure you don't enter a cycle where you recurse into the same object more than once. So something like this:

```typescript
function infiniteRecursion(value, ctrl) {
    return ctrl.recurse(value);
}
```

Which would normally cause infinite recursion would just throw an error. This also means that mutating the object you're working on and then recursing into it is a bad idea.

However, you can still end up with a stack overflow if you're not careful (or try to do it on purpose), such as:

```typescript
function reallyInfiniteRecursion(value, ctrl) {
    return ctrl.recurse(value + "a");
}
```

If you started with `""`, this would end up recursing into `a` , then `aa`, then `aaa`, and so on.

Note that there is little reason to use `recurse` in the error transforms.

### Adding transform steps

You add transforms when you create a session. One of the session configuration parameters is the `services` function, which lets you modify the set of services. One thing you can do is add transformation steps:

```typescript
let x = Wampus.create({
    //...
    services(svcs) {
        svcs.transforms.jsonToObject.add(function myExtraStep(value, ctrl) {
            //...
        });
        
    }
})
```

Note that transform steps are added LIFO (or maybe Last-In-First-Executed), so the initial steps will be fallbacks to steps you add later (this, again, allows Wampus to have its own fallback steps).

### Transform types

Wampus uses four transforms:

1. Object transformations
   1. `jsonToObject`
   2. `objectToJson`
2. Error transformations
   1. `errorToErrorResponse`
   2. `errorResponseToError`

The transforms `jsonToObject` and `objectToJson` recursively transform all objects within `args` and `kwargs` properties in both directions. 

The error transformations are applied when turning a JavaScript error into an error response, and vice versa. Before the error transformations are applied, the object transformations are first applied on the `args` and `kwargs` fields.

Note that there is little reason to use recursion in the error transformations, but it's still an option.

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
let x = Wampus.create({
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