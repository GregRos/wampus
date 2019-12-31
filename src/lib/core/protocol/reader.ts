import {Wamp, WampRawMessage} from "./messages";
import {WampType} from "./message.type";

/**
 * A class that converts a raw WAMP protocol message in the form of an array into a WAMP message object.
 */
export class MessageReader {
    /**
     * Parses a raw WAMP message in the form of an array into a message object.
     * @param raw The raw message.
     * @see [WAMP Basic Profile]{@link https://wamp-proto.org/static/rfc/draft-oberstet-hybi-crossbar-wamp.html#message-definitions}
     * @see [WAMP Advanced Profile]{@link https://wamp-proto.org/static/rfc/draft-oberstet-hybi-crossbar-wamp.html#rfc.section.14.1.1}
     */
    parse(raw: WampRawMessage): Wamp.Any {
        switch (raw[0]) {
            case WampType.WELCOME:
                return new Wamp.Welcome(raw[1], raw[2] || {});
            case WampType.ABORT:
                return new Wamp.Abort(raw[1], raw[2] || {});
            case WampType.GOODBYE:
                return new Wamp.Goodbye(raw[1], raw[2]);
            case WampType.ERROR:
                return new Wamp.Error(raw[1], raw[2], raw[3] || {}, raw[4], raw[5] || [], raw[6] || {});
            case WampType.PUBLISHED:
                return new Wamp.Published(raw[1], raw[2]);
            case WampType.SUBSCRIBED:
                return new Wamp.Subscribed(raw[1], raw[2]);
            case WampType.UNSUBSCRIBED:
                return new Wamp.Unsubscribed(raw[1]);
            case WampType.EVENT:
                return new Wamp.Event(raw[1], raw[2], raw[3] || {}, raw[4] || [], raw[5] || {});
            case WampType.RESULT:
                return new Wamp.Result(raw[1], raw[2] || {}, raw[3] || [], raw[4] || {});
            case WampType.REGISTERED:
                return new Wamp.Registered(raw[1], raw[2]);
            case WampType.UNREGISTERED:
                return new Wamp.Unregistered(raw[1]);
            case WampType.INVOCATION:
                return new Wamp.Invocation(raw[1], raw[2], raw[3] || {}, raw[4] || [], raw[5] || {});
            case WampType.CHALLENGE:
                return new Wamp.Challenge(raw[1], raw[2] || {});
            case WampType.INTERRUPT:
                return new Wamp.Interrupt(raw[1], raw[2] || {});
            case WampType.SUBSCRIBE:
                return new Wamp.Subscribe(raw[1], raw[2] || {}, raw[3]);
            case WampType.UNREGISTER:
                return new Wamp.Unregister(raw[1], raw[2]);
            case WampType.PUBLISH:
                return new Wamp.Publish(raw[1], raw[2], raw[3] || {}, raw[4] || [], raw[5] || {});
            case WampType.CALL:
                return new Wamp.Call(raw[1], raw[2], raw[3] || {}, raw[3] || [], raw[5] || {});
            case WampType.REGISTER:
                return new Wamp.Register(raw[1], raw[2] || {}, raw[3]);
            case WampType.HELLO:
                return new Wamp.Hello(raw[1], raw[2] || {});
            case WampType.YIELD:
                return new Wamp.Yield(raw[1], raw[2] || {}, raw[3] || [], raw[4] || {});
            case WampType.AUTHENTICATE:
                return new Wamp.Authenticate(raw[1], raw[2] || {});
            case WampType.CANCEL:
                return new Wamp.Cancel(raw[1], raw[2] || {});
            default:
                return new Wamp.Unknown(raw);
        }
    }
}