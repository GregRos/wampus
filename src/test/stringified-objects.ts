import {RealSessions} from "~test/helpers/real-sessions";
import {Routes} from "~lib/core/routing/routes";
import invocation = Routes.invocation;

export async function stringify(log: (...xs) => void) {
    function printObject(name: string, x: any) {
        log(`-------${name}-------`)
        log(x.toString());
    }
    const session = await RealSessions.session();
    printObject("Session", session);

    const procedure = await session.procedure({
        name: "abc",
        async called(ticket) {
            printObject("Invocation", ticket);
            return {
                args: [0]
            }
        }
    });
    printObject("Procedure", procedure);

    const call = session.call({
        name: "abc"
    });
    printObject("Call", call);

    const result = await call;

    printObject("CallResult", result);

    const subscription = await session.topic({
        name: "abc"
    });
    printObject("Subscription", subscription);

    await session.close()
}

stringify(console.log);