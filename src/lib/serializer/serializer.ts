export interface WampusSerializer {
    serialize(msg: object): Buffer | ArrayBuffer | string;

    deserialize(buffer: Buffer | ArrayBuffer | string | Buffer[]): object;

    readonly id: string;
}