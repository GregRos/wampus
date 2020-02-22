import {MessageFactory} from "../protocol/factory";

/**@internal*/
export const DefaultMessageFactory = new MessageFactory({
    reqId() {
        return Math.floor(Math.random() * (1 << 30));
    }
});