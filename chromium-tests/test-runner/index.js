
const {listen} = require("./web-test-host");
const {run} = require("./puppeteer-launcher");

(async() => {
    await listen(9000);

    await run(9000);
})();


