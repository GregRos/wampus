export default function factory() {
    return {
        files : [
            "dist/test/tests/**/*.js",
            "dist/test/tests/*.js"
        ],
        require : [
            "source-map-support/register"
        ],

    }
}