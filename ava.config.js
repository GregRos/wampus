export default function factory() {
    return {
        files : [
            "dist/test/tests/**/*.js",
            "dist/test/tests/wamp/*.js",
        ],
        require : [
            "source-map-support/register"
        ],

    }
}