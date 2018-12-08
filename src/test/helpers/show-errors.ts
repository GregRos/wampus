import exps = require("ava/lib/assert");

let origAss = exps.wrapAssertions;

exps.wrapAssertions = function (cbs) {
    cbs = origAss(cbs);
    let origThrows = cbs.throws;
    cbs.throws = function (...args) {
        if (args[0] instanceof Promise) {
            args[0] = args[0].catch(err => {
                console.error(err);
                throw err;
            });
        }
        return origThrows.apply(this, args);
    };
    return cbs;
};