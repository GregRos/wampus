import {WampusSerializer} from "./serializer";
declare type Blob = any;
const toBuffer = require('blob-to-buffer')
export class WampusJsonSerializer implements WampusSerializer {
    readonly id: string;

    deserialize(buffer: Buffer): object {
        let str = buffer.toString("utf8");
        return JSON.parse(str);
    }

    serialize(msg: object): Buffer | ArrayBuffer | string {
        return undefined;
    }

}