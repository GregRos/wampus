const tsConfigPaths = require("tsconfig-paths");
const tsconfig = require("./tsconfig.json");
const cleanup = tsConfigPaths.register({
    baseUrl: __dirname,
    paths: tsconfig.compilerOptions.paths
});
