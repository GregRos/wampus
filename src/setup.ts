require("source-map-support/register");
Error.stackTraceLimit = 50;
process.on("unhandledRejection", (oError, promise) => {
    let error = oError as any;
    let msg = typeof error === "object" ? error.message || JSON.stringify(error) : error;
    console.error(`== Node detected an unhandled rejection! ==${msg}`);

    console.error(error.stack);
});
