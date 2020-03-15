import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import {WebpackOptions} from "webpack/declarations/WebpackOptions";
import * as path from "path";
import {SourceMapDevToolPlugin} from "webpack";

export default {
    mode: "development",
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        plugins: [new TsconfigPathsPlugin({
            configFile: path.resolve(`./src/browser-test/tsconfig.json`)
        })]
    },
    module: {
        rules: [{
                test: /\.js$/,
                use: ["source-map-loader"],
                enforce: "pre"
        }],
    },
    devtool: false,
    plugins: [
        new SourceMapDevToolPlugin({
            // This will make the source map path a lot nicer
            moduleFilenameTemplate: "[namespace]/[resource-path]"
        })
    ]
} as WebpackOptions;