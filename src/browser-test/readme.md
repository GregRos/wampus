The main tests are written with ava, but it turned out that ava doesn't support running in the browser, so I can't just run the full test suite there. 

I really like ava, so I can't just ditch it and rewrite the tests (also it's a lot of work). So instead I wrote a separate test suite for the browser. The only difference between the environments with regard to this library are  the websocket and its API, so there shouldn't be much problem.

Right now, these tests are executed using a mess of frameworks, launchers, and libraries.

The tests are written with mocha and chai. They are run on a version of Chrome downloaded by puppeteer, using karma. Karma uses a webpack preprocessor to bundle all the dependencies and the like. Webpack and karma are configured to handle source maps from the previously compiled typescript (I want to keep compilation in one place).

The result is actually pretty nice. The test can be executed automatically, run fairly quickly, and the stack traces are very good.

In the future, it might be worth it to rewrite all the tests using mocha, or maybe switch to jasmine or something, or maybe even add browser support to ava if that's feasible (ava uses a lot of digging around in the node environment though, so I'm not sure how feasible that would be).