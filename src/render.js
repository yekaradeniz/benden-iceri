import { chromium } from 'playwright';
import { renderHtml } from './renderHtml.js';

export async function renderToPng(data, outputPath) {
  const html = renderHtml(data);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1350 },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    // Wait for fonts to fully load
    await page.evaluate(() => document.fonts.ready);

    // Wait for background image to load
    await page.waitForFunction(() => {
      const bg = document.querySelector('.post-bg');
      if (!bg) return true;
      const url = window.getComputedStyle(bg).backgroundImage;
      const match = url.match(/url\("?(.+?)"?\)/);
      if (!match) return true;
      const img = new Image();
      img.src = match[1];
      return img.complete;
    }, { timeout: 15_000 });

    await page.screenshot({
      path: outputPath,
      type: 'png',
      omitBackground: false,
      fullPage: false
    });
  } finally {
    await browser.close();
  }
}
