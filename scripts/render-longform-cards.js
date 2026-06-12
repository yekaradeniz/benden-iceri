/**
 * Long-form (yatay 1920x1080) intro ve outro kartlarini render eder - onizleme.
 * Gercek videoda cami videosu uzerine biner; burada koyu zemine basiyoruz.
 *  output/lf-intro.png , output/lf-outro.png
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function render(html, out) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: out, type: 'png' });
    console.log('Kaydedildi:', out);
  } finally { await browser.close(); }
}

// Cami videosu + koyu overlay hissi veren zemin
const BG = `
  radial-gradient(ellipse at 50% 38%, rgba(58,33,18,0.65) 0%, rgba(20,12,7,0.92) 55%, rgba(8,5,3,0.98) 100%),
  linear-gradient(180deg, #0e0b08 0%, #16100a 100%)`;

const HEAD = `
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1920px; height:1080px; overflow:hidden; }
body { background:${BG}; display:flex; align-items:center; justify-content:center; }
.wrap { text-align:center; display:flex; flex-direction:column; align-items:center; }
.orn { color:#e8b86c; letter-spacing:26px; font-size:30px; opacity:0.6; margin-bottom:34px; }
.brand {
  font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:600;
  font-size:104px; letter-spacing:3px; line-height:1;
  background:linear-gradient(180deg,#faecc4 0%,#e8b86c 55%,#b68545 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
  text-shadow:0 4px 60px rgba(232,184,108,0.18);
}
.divider { display:flex; align-items:center; gap:24px; margin:38px 0 30px; width:560px; }
.dline { flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(232,184,108,0.7),transparent); }
.ddia { width:7px; height:7px; background:#e8b86c; transform:rotate(45deg); opacity:0.85; }
.gazel { font-family:'Inter',sans-serif; font-weight:400; font-size:30px; letter-spacing:13px;
  text-transform:uppercase; color:#e8b86c; opacity:0.85; margin-bottom:30px; }
.firstline { font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:500;
  font-size:52px; color:#f5efe1; line-height:1.4; max-width:1300px; text-shadow:0 2px 20px rgba(0,0,0,0.7); }
.sub1 { font-family:'Inter',sans-serif; font-weight:300; font-size:40px; color:#f5efe1;
  opacity:0.92; margin-bottom:18px; letter-spacing:1px; }
.sub2 { font-family:'Inter',sans-serif; font-weight:300; font-size:34px; color:#e8b86c;
  opacity:0.85; letter-spacing:3px; }
</style>`;

const intro = `<!DOCTYPE html><html><head>${HEAD}</head><body>
<div class="wrap">
  <div class="orn">&#10022; &nbsp; &#10022; &nbsp; &#10022;</div>
  <div class="brand">Salih Baba Dîvânı</div>
  <div class="divider"><div class="dline"></div><div class="ddia"></div><div class="dline"></div></div>
  <div class="gazel">Birinci Gazel</div>
  <div class="firstline">"Bed' olunsun besmeleyle hamdeleyle evsatı"</div>
</div>
</body></html>`;

const outro = `<!DOCTYPE html><html><head>${HEAD}</head><body>
<div class="wrap">
  <div class="orn">&#10022; &nbsp; &#10022; &nbsp; &#10022;</div>
  <div class="brand">Salih Baba Dîvânı</div>
  <div class="divider"><div class="dline"></div><div class="ddia"></div><div class="dline"></div></div>
  <div class="sub1">Her hafta bir gazel, mânâsıyla.</div>
  <div class="sub2">Abone olarak bu yolculuğa katılın</div>
</div>
</body></html>`;

await render(intro, join(ROOT, 'output', 'lf-intro.png'));
await render(outro, join(ROOT, 'output', 'lf-outro.png'));
