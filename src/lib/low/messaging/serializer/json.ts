import {Serializer} from "./serializer";
declare type Blob = any;
export class JsonSerializer implements Serializer {
    readonly id = "json";

    deserialize(buffer: Buffer): object {
        let str = buffer.toString("utf8");
        return JSON.parse(str);
    }

    serialize(msg: object): Buffer | ArrayBuffer | string {
        let str =  JSON.stringify(msg);
        return Buffer.from(str, "utf8");
    }

}