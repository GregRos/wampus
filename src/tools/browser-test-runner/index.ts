import {Server} from "karma";

const server = new Server({
    configFile: require.resolve("./karma.config")
}, exitCode => {
    console.log(`Karma has exited with ${exitCode}`);
    process.exit(exitCode);
});

server.start();
