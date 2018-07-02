import {WampMsgType} from "../proto/message.type";
import {WampMessage, WampMessageFactory, WampRawMessage} from "../proto/messages";
import most = require("most");
export type ExpectSubscriber = (msg : WampMessage.Any) => boolean;

export interface RecursiveFilterSet {
    all : ExpectSubscriber[];
    child : Map<string | number, RecursiveFilterSet>;
}

export class ExpectationStore {
    constructor(factory: (raw: WampRawMessage) => WampMessage.Any) {
        this._factory = factory;
    }
    private _map = new Map<WampMsgType, {
        all : ExpectSubscriber[];
        child : Map<number, ExpectSubscriber[]>
    }>();
    private _factory : (raw : WampRawMessage) => WampMessage.Any;

    expect(msgType : WampMsgType, param2 : number) {
        let store = this;
        return new most.Stream({
            run(sink, x) {
                store.addExpectation(msgType, param2, x => {})
            }
        });
        )
    }

    addExpectation(msgType : WampMsgType, param2 : number | null, subscriber : ExpectSubscriber) {
        let byArg2 = this._map.get(msgType);
        if (!byArg2) {
            byArg2 = {
                all : [],
                child : new Map<number, any>()
            };
            this._map.set(msgType, byArg2);
        }
        if (param2 == null) {
            byArg2.all.push(subscriber);
        } else {
            let getMyParam2 = byArg2.child.get(param2);
            if (!getMyParam2) {
                getMyParam2 = [];
                byArg2.child.set(param2, getMyParam2);
            }
            getMyParam2.push(subscriber);
        }
    }

    resolve(msg : WampRawMessage) : boolean {
        let full = this._factory(msg);
        let myMsgTypeSet = this._map.get(msg[0]);
        if (!myMsgTypeSet) return false;
        let resolved = false;
        myMsgTypeSet.all = myMsgTypeSet.all.filter(subscriber => {
            let result = subscriber(full);
            if (result) resolved = true;
            return !result;
        });
        if (typeof msg[1] === "number") {
            let myArg2 = myMsgTypeSet.child.get(msg[1]);
            if (myArg2) {
                myArg2 = myArg2.filter(subscriber => {
                    let result = subscriber(full)
                    if (result) resolved = true;
                    return !result;
                });
                myMsgTypeSet.child.set(msg[1], myArg2);
            }
        }
    }

    close() {
        this._map = null;
    }
}