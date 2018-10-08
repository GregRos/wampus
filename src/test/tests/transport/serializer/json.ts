import test from "ava";
import {describe} from 'ava-spec';
import {JsonSerializer} from "../../../../lib/core/messaging/serializer/json";


/*
    The JSON serializer is really simple and you can't really test it without re-implementing its logic.
    So both serialize and deserialize are tested.
 */
describe("json serializer", it => {
    let serializer = () => new JsonSerializer();
    test("id", t => {
        let s = serializer();
        t.is(s.id, "json");
    });
    describe("serialize+deserialize", () => {
        let testWith = (name : string, obj : any) => {
            test(name, async t => {
                let s = serializer();
                t.deepEqual(s.deserialize(s.serialize(obj)), obj);
            });
        };
        testWith("simple json", {
            a : 1
        });
        testWith("number", 5);
        testWith("string", "hi");
        testWith("boolean", true);
    });
});