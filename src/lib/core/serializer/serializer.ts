export interface Serializer {
    readonly id: string;

    serialize(msg: object): Buffer | ArrayBuffer | string;

    deserialize(buffer: Buffer | ArrayBuffer | string | Buffer[]): object;
}