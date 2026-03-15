const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('BROWSER ERROR:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message);
    });

    try {
        await page.goto('http://localhost:5000/Dashboard', { waitUntil: 'networkidle2' });
        // wait a few seconds to let React crash if it's going to
        await new Promise(r => setTimeout(r, 2000));
        console.log('Finished capturing logs');
    } catch (e) {
        console.error('Navigation error:', e);
    } finally {
        await browser.close();
    }
})();
