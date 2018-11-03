
require("source-map-support/register");
Error.stackTraceLimit = 50;
process.on("unhandledRejection", (error, promise) => {
    let msg = typeof error === "object" ? error.message || JSON.stringify(error) : error;
    console.error(`== Node detected an unhandled rejection! ==${msg}`);

    console.error(error.stack);
});
