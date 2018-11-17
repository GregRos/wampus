import {WampMessage, WampRawMessage} from "./messages";
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
    parse(raw: WampRawMessage): WampMessage.Any {
        switch (raw[0]) {
            case WampType.WELCOME:
                return new WampMessage.Welcome(raw[1], raw[2] || {});
            case WampType.ABORT:
                return new WampMessage.Abort(raw[1], raw[2] || {});
            case WampType.GOODBYE:
                return new WampMessage.Goodbye(raw[1], raw[2]);
            case WampType.ERROR:
                return new WampMessage.Error(raw[1], raw[2], raw[3] || {}, raw[4], raw[5] || [], raw[6] || {});
            case WampType.PUBLISHED:
                return new WampMessage.Published(raw[1], raw[2]);
            case WampType.SUBSCRIBED:
                return new WampMessage.Subscribed(raw[1], raw[2]);
            case WampType.UNSUBSCRIBED:
                return new WampMessage.Unsubscribed(raw[1]);
            case WampType.EVENT:
                return new WampMessage.Event(raw[1], raw[2], raw[3] || {}, raw[4] || [], raw[5] || {});
            case WampType.RESULT:
                return new WampMessage.Result(raw[1], raw[2] || {}, raw[3] || [], raw[4] || {});
            case WampType.REGISTERED:
                return new WampMessage.Registered(raw[1], raw[2]);
            case WampType.UNREGISTERED:
                return new WampMessage.Unregistered(raw[1]);
            case WampType.INVOCATION:
                return new WampMessage.Invocation(raw[1], raw[2], raw[3] || {}, raw[4] || [], raw[5] || {});
            case WampType.CHALLENGE:
                return new WampMessage.Challenge(raw[1], raw[2] || {});
            case WampType.INTERRUPT:
                return new WampMessage.Interrupt(raw[1], raw[2] || {});
            case WampType.SUBSCRIBE:
                return new WampMessage.Subscribe(raw[1], raw[2] || {}, raw[3]);
            case WampType.UNREGISTER:
                return new WampMessage.Unregister(raw[1], raw[2]);
            case WampType.PUBLISH:
                return new WampMessage.Publish(raw[1], raw[2], raw[3] || {}, raw[4] || [], raw[5] || {});
            case WampType.CALL:
                return new WampMessage.Call(raw[1], raw[2], raw[3] || {}, raw[3] || [], raw[5] || {});
            case WampType.REGISTER:
                return new WampMessage.Register(raw[1], raw[2] || {}, raw[3]);
            case WampType.HELLO:
                return new WampMessage.Hello(raw[1], raw[2] || {});
            case WampType.YIELD:
                return new WampMessage.Yield(raw[1], raw[2] || {}, raw[3] || [], raw[4] || {});
            case WampType.AUTHENTICATE:
                return new WampMessage.Authenticate(raw[1], raw[2] || {});
            case WampType.CANCEL:
                return new WampMessage.Cancel(raw[1], raw[2] || {});
            default:
                return new WampMessage.Unknown(raw);
        }
    }
}