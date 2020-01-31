/**
 * Turns objects into string or binary data, and vice versa.
 */
export interface Serializer {
    readonly id: string;

    /**
     * Serialize an object to a string or binary form.
     * @param msg The object.
     */
    serialize(msg: object): Buffer | ArrayBuffer | string;

    /**
     * Parse a buffer, string, etc into an object.
     * @param data The data.
     */
    deserialize(data: Buffer | ArrayBuffer | string | Buffer[]): object;
}