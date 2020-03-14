const WebpackDevServer = require("webpack-dev-server");
const webpack = require("webpack");
const {promisify} = require("util");
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const wpCompiler = webpack({
    entry: `${__dirname}/../web/index.ts`,
    mode: "development",
    output: {
        filename: "bundle.js",
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        plugins: [new TsconfigPathsPlugin({
            configFile: `${__dirname}/../tsconfig.json`
        })]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/,
                options: {
                    projectReferences: true,
                    compilerOptions: {
                        noEmit: false
                    }
                }
            },
            {
                test: /^$/,
                loader: "mocha-loader",
                exclude: /node_modules/,
            },
        ],
    },
    devtool: "source-map",
});

const server = new WebpackDevServer(wpCompiler, {
    contentBase: `${__dirname}/../web`,
    contentBasePublicPath: '/',
});

Object.assign(exports, {
    async listen(port) {
        return promisify(server.listen.bind(server))(port, "0.0.0.0").then(() => {
            console.log("Starting server on http://localhost:9000");
        });
    }
});