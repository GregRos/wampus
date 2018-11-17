
/**
 * The message type IDs for all messages in the WAMP protocol specification.
 * @see [Basic Profile]{@link https://wamp-proto.org/_static/wamp_latest.html#message-codes-and-direction}
 * @see [Advanced Profile]{@link https://wamp-proto.org/_static/wamp_latest.html#message-codes-and-direction-0}
 */
export enum WampType {
    HELLO = 1,
    WELCOME = 2,
    ABORT = 3,
    GOODBYE = 6,
    ERROR = 8,
    PUBLISH = 16,
    PUBLISHED = 17,
    SUBSCRIBE = 32,
    SUBSCRIBED = 33,
    UNSUBSCRIBE = 34,
    UNSUBSCRIBED = 35,
    EVENT = 36,
    CALL = 48,
    RESULT = 50,
    REGISTER = 64,
    REGISTERED = 65,
    UNREGISTER = 66,
    UNREGISTERED = 67,
    INVOCATION = 68,
    YIELD = 70,
    CANCEL = 49,
    CHALLENGE = 4,
    AUTHENTICATE = 5,
    INTERRUPT = 69,
    _Unknown = -1
}