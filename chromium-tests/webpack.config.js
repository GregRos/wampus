const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
    entry: `${__dirname}/web/index.ts`,
    mode: 'development',
    output: {
        filename: 'bundle.js',
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ],
        plugins: [new TsconfigPathsPlugin({
            configFile: `${__dirname}/tsconfig.json`
        })]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
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
                loader: 'mocha-loader',
                exclude: /node_modules/,
            },
        ],
    },
    devtool: 'source-map',
    devServer: {
        contentBase: `${__dirname}/web`,
        contentBasePublicPath: '/',
        port: 9000
    }
};