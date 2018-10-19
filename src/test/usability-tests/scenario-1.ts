import {Wampus} from "../../lib/wrappers/wampus";
import "../../setup";
import {map} from "rxjs/operators";
import {WampResult} from "../../lib/core";
export async function main() {
    let session = await Wampus.create({
        realm : "proxy",
        transport : {
            type : "websocket",
            serializer : "json",
            url : "ws://127.0.0.1:9003"
        }
    });

    let procedure = await session.register({name : "multiply_by_two"}, async x => {
        return {
            args : [x.args[0] * 2]
        };
    });

    let call = session.call({name : "multiply_by_two", args : [10]});
    let x = await call.result;
    console.log("It was a ", x.args[0]);

}
main();