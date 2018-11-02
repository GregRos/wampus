import {Serializer} from "./serializer";
declare type Blob = any;
export class JsonSerializer implements Serializer {
    readonly id = "json";

    deserialize(buffer: Buffer | string | ArrayBuffer): object {
        let str : string;
        if (typeof buffer === "string") {
            str = buffer;
        } else if (buffer instanceof Buffer) {
            str = buffer.toString("utf8");
        } else {
            throw new Error("Unsupported message data format.");
        }
        return JSON.parse(str);
    }

    serialize(msg: object): Buffer | ArrayBuffer | string {
        let str =  JSON.stringify(msg);
        return Buffer.from(str, "utf8");
    }

}