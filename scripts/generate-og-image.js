const puppeteer = require('puppeteer');

async function convertToPng() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  
  await page.goto('https://bharath-code.github.io/snip/og-image.html', { waitUntil: 'networkidle0' });
  
  await page.screenshot({
    path: 'docs/og-image-snip.png',
    type: 'png'
  });
  
  await browser.close();
  console.log('OG image generated: docs/og-image-snip.png');
}

convertToPng().catch(console.error);
