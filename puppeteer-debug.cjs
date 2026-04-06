const puppeteer = require("puppeteer");

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Listen to all console messages
    page.on('console', msg => {
      // If it's an error, print it
      if (msg.type() === 'error') {
        console.log('BROWSER_CONSOLE_ERROR:', msg.text());
      }
    });

    page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR:', error.message));

    console.log("Navigating to http://localhost:5173 ...");
    await page.goto("http://localhost:5173", { waitUntil: "networkidle0", timeout: 10000 });
    
    console.log("Page loaded. Extracting root DOM...");
    const rootHTML = await page.evaluate(() => {
      return document.getElementById("root") ? document.getElementById("root").innerHTML : "NO_ROOT";
    });
    console.log("Root element length:", rootHTML.length);
    if (rootHTML.length === 0) {
      console.log("WHITE SCREEN CONFIRMED. The root is totally empty.");
    }

    await browser.close();
  } catch (err) {
    console.error("Puppeteer Error:", err);
  }
})();
