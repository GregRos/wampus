const puppeteer = require("puppeteer");

Object.assign(exports, {
    async run(port) {
        console.log("Doing the puppeteer thing!!! bkag")
        const browser = await puppeteer.launch({
            headless: false,
            args: ["--no-sandbox", "--disable-gpu"]
        });
        const page = await browser.newPage();
        await page.goto(`https://www.google.com`, {
            waitUntil: "load"
        });
    }
});