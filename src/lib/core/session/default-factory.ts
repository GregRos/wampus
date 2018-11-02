import {MessageFactory} from "../protocol/factory";
/**@internal*/
export const DefaultMessageFactory = new MessageFactory({
    requestId() {
        return Math.floor(Math.random() * (2 << 50));
    }
});