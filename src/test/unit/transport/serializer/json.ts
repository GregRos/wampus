import test from "ava";
import {JsonSerializer} from "../../../../lib/core/serializer/json";

let serializer = () => new JsonSerializer();

let testWith = (name: string, obj: any) => {
    test(name, async t => {
        let s = serializer();
        t.deepEqual(s.deserialize(s.serialize(obj)), obj);
    });
};
testWith("simple json", {
    a: 1
});
testWith("number", 5);
testWith("string", "hi");
testWith("boolean", true);