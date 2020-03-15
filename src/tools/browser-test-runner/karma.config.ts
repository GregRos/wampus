import {Config, ConfigOptions} from "karma";
import * as path from "path";
import wpc from "./webpack.config";
process.env.CHROME_BIN = require("puppeteer").executablePath();

// This will catch some errors that would otherwise be hidden

process.on("infrastructure_error" as any,error => {
    console.error("infrastructure_error", error);
});
module.exports = (config: Config) => {
    config.set({
        basePath: "../../../",
        frameworks: ["source-map-support", "mocha"],
        files: [
            "./dist/browser-test/*.js",
        ],
        logLevel: config.LOG_INFO,
        browsers: ["CompatibleChromeHeadless"],
        reporters: ["mocha"],
        customLaunchers: {
            CompatibleChromeHeadless: {
                base: "ChromeHeadless",
                // Compatibility switches so it will work on WSLv1
                flags: ["--single-process", "--no-sandbox"]
            }
        },
        preprocessors: {
            "./dist/browser-test/*.js": ["webpack"]
        },
        singleRun: true
    });
    config.set({
        webpack: wpc
    } as any);
};