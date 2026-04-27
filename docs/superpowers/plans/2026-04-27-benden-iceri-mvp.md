# benden içeri — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully autonomous Instagram automation that posts one Sufi/aşk-yolculuğu verse per day to @benden.iceri using GitHub Actions + Instagram Graph API + curated Unsplash photos. Zero monthly cost. Mac doesn't need to be on.

**Architecture:** A Node.js monorepo with content (`verses.json`, `photos.json`), HTML template (Cormorant Italic + photo + dark overlay), Playwright headless renderer (HTML → PNG 1080×1350), Instagram Graph API client, and GitHub Actions cron that ties them together daily at 09:00 GMT+3.

**Tech Stack:** Node.js 20 (ESM), Playwright (Chromium headless), Vitest (testing), Instagram Graph API v21.0, GitHub Actions (cron + artifacts).

---

## File Structure

```
benden-iceri/
├── package.json                         # ESM, Node 20+, vitest
├── .gitignore                           # node_modules, output/*.png
├── .nvmrc                               # 20
├── README.md                            # setup, secrets, troubleshooting
│
├── content/
│   ├── verses.json                      # batch verse content (90+ entries)
│   └── photos.json                      # mood-tagged Unsplash photos
│
├── template/
│   └── post.html                        # HTML with {{variables}}, embedded CSS
│
├── src/
│   ├── pickContent.js                   # pure: index → verse entry
│   ├── pickPhoto.js                     # pure: moods, history → photo entry
│   ├── renderHtml.js                    # pure: data → filled HTML string
│   ├── render.js                        # Playwright: HTML → PNG file
│   ├── postToInstagram.js               # IG Graph API client (2-step)
│   └── index.js                         # main: pick → render → post
│
├── tests/
│   ├── pickContent.test.js
│   ├── pickPhoto.test.js
│   ├── renderHtml.test.js
│   ├── render.test.js                   # integration with real Playwright
│   ├── postToInstagram.test.js          # mocked fetch
│   └── index.test.js                    # mocked all I/O
│
├── output/                              # rendered PNGs (committed for raw URL)
│   └── .gitkeep
│
└── .github/
    └── workflows/
        └── daily.yml                    # cron + workflow_dispatch
```

**Module responsibilities:**
- `pickContent`: deterministic from index (days since launch). Pure function.
- `pickPhoto`: deterministic given verse moods + recent history. Pure function.
- `renderHtml`: string templating. Pure function.
- `render`: side effects (Playwright, file write).
- `postToInstagram`: side effects (HTTP).
- `index`: orchestrator, reads/writes state file (`output/log.json`).

---

## Task 1: Initialize Node.js Project

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Modify: `.gitignore`
- Create: `output/.gitkeep`

- [ ] **Step 1.1: Create `.nvmrc`**

```
20
```

- [ ] **Step 1.2: Create `package.json`**

```json
{
  "name": "benden-iceri",
  "version": "0.1.0",
  "description": "Daily aşk yolculuğu verses, automated to Instagram",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "render": "node src/index.js render",
    "post": "node src/index.js post",
    "daily": "node src/index.js daily"
  },
  "dependencies": {
    "playwright": "^1.49.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 1.3: Update `.gitignore`**

Append to existing `.gitignore`:

```
node_modules/
.DS_Store
.env
.env.local

# Output PNGs are committed for IG raw URL access — but exclude older than 30 days via maintenance script (Phase 2)
# Comment: keep output/ tracked initially
```

- [ ] **Step 1.4: Create empty output dir**

```bash
touch output/.gitkeep
```

- [ ] **Step 1.5: Install dependencies**

```bash
npm install
```

Expected: creates `node_modules/`, `package-lock.json`, no errors.

- [ ] **Step 1.6: Install Playwright Chromium browser**

```bash
npx playwright install chromium
```

Expected: downloads Chromium ~150MB to `~/Library/Caches/ms-playwright/`.

- [ ] **Step 1.7: Smoke-test vitest**

```bash
npx vitest run --reporter=verbose
```

Expected: "No test files found" — exit 0. Confirms vitest installed.

- [ ] **Step 1.8: Commit**

```bash
git add .nvmrc package.json package-lock.json .gitignore output/.gitkeep
git commit -m "chore: initialize Node.js project with Playwright + vitest"
```

---

## Task 2: Content Schemas — `verses.json` and `photos.json`

**Files:**
- Create: `content/verses.json`
- Create: `content/photos.json`

These are static data files. Validation comes via the picker tests in Task 3.

- [ ] **Step 2.1: Create `content/verses.json`**

Seed with 5 verifiable entries. Real verses only — illustrative entries marked clearly.

```json
[
  {
    "id": "001",
    "verse": "Bir ben vardır bende\nbenden içeri.",
    "original": null,
    "source": "Yûnus Emre",
    "moods": ["halvet", "ic-dunya", "tefekkür"],
    "format": "A",
    "caption": "bir mısra, bir kapı 🌙\n\n#niyazimisri #salihbaba #askyolculugu",
    "verified": true
  },
  {
    "id": "002",
    "verse": "Derman arardım derdime,\nderdim bana derman imiş.",
    "original": null,
    "source": "Niyazî-i Mısrî",
    "moods": ["ic-dunya", "tefekkür", "ask-yangini"],
    "format": "A",
    "caption": "her derdin şifâsı kendisindedir 🌿\n\n#niyazimisri #askyolculugu",
    "verified": true
  },
  {
    "id": "003",
    "verse": "Gönül Yâr ile,\nel iş ile olsun.",
    "original": "\"Dil ber yâr u dest ber kâr\"",
    "source": "Bahâeddin Nakşbend",
    "moods": ["mihrap", "tefekkür", "halvet"],
    "format": "C",
    "caption": "gönlün ile elin aynı yerde olmasın 🕊️\n\n#askyolculugu #tasavvuf",
    "verified": true
  },
  {
    "id": "004",
    "verse": "Aşkın elinden cânım,\nseyrânlara düştüm.",
    "original": null,
    "source": "Salih Baba Dîvânı",
    "moods": ["seyran", "ask-yangini", "yalnizlik"],
    "format": "A",
    "caption": "aşk bir yolculuktur 🌙\n\n#salihbaba #askyolculugu",
    "verified": false
  },
  {
    "id": "005",
    "verse": "Halvet der encümen.",
    "original": null,
    "source": "Bahâeddin Nakşbend",
    "moods": ["halvet", "ic-dunya"],
    "format": "A",
    "caption": "kalabalıkta yalnızlık 🌿\n\n#askyolculugu",
    "verified": true
  }
]
```

**Note:** Entries with `"verified": false` need source verification before launch. Entry 004's exact wording attributed to Salih Baba should be cross-checked against Tâcü'l-Ârifîn.

- [ ] **Step 2.2: Create `content/photos.json`**

Seed with 10 hand-picked Unsplash photos covering all 9 moods.

```json
[
  {
    "id": "candle-warm-01",
    "url": "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=1200&q=85",
    "moods": ["halvet", "ask-yangini", "ic-dunya"],
    "credit": "Unsplash"
  },
  {
    "id": "mosque-light-01",
    "url": "https://images.unsplash.com/photo-1542856391-010fb87dcfed?w=1200&q=85",
    "moods": ["mihrap", "tefekkür"],
    "credit": "Unsplash"
  },
  {
    "id": "desert-tree-01",
    "url": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=85",
    "moods": ["seyran", "yalnizlik"],
    "credit": "Unsplash"
  },
  {
    "id": "old-book-01",
    "url": "https://images.unsplash.com/photo-1532153975070-2e9ab71f1b14?w=1200&q=85",
    "moods": ["divan", "tefekkür"],
    "credit": "Unsplash"
  },
  {
    "id": "night-sky-01",
    "url": "https://images.unsplash.com/photo-1532978879514-6cc1d61aa5fb?w=1200&q=85",
    "moods": ["gece", "tefekkür", "yalnizlik"],
    "credit": "Unsplash"
  },
  {
    "id": "water-reflect-01",
    "url": "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1200&q=85",
    "moods": ["tefekkür", "ic-dunya"],
    "credit": "Unsplash"
  },
  {
    "id": "window-light-01",
    "url": "https://images.unsplash.com/photo-1515462277126-2dd0c162007a?w=1200&q=85",
    "moods": ["ic-dunya", "halvet", "mihrap"],
    "credit": "Unsplash"
  },
  {
    "id": "lone-figure-01",
    "url": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=85",
    "moods": ["yalnizlik", "seyran"],
    "credit": "Unsplash"
  },
  {
    "id": "earth-rain-01",
    "url": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&q=85",
    "moods": ["tefekkür", "ic-dunya"],
    "credit": "Unsplash"
  },
  {
    "id": "candle-warm-02",
    "url": "https://images.unsplash.com/photo-1502209524164-acea936639a2?w=1200&q=85",
    "moods": ["halvet", "ask-yangini", "gece"],
    "credit": "Unsplash"
  }
]
```

- [ ] **Step 2.3: Commit**

```bash
git add content/
git commit -m "feat: seed content schemas with 5 verses + 10 mood-tagged photos"
```

---

## Task 3: Content Picker — `pickContent.js`

**Files:**
- Create: `src/pickContent.js`
- Create: `tests/pickContent.test.js`

Pure deterministic function: given verses array and an index (days since launch), returns the verse at `index % verses.length`. Wraps around when batch exhausted.

- [ ] **Step 3.1: Write the failing test**

Create `tests/pickContent.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { pickContent } from '../src/pickContent.js';

const sampleVerses = [
  { id: '001', verse: 'first', source: 'A' },
  { id: '002', verse: 'second', source: 'B' },
  { id: '003', verse: 'third', source: 'C' }
];

describe('pickContent', () => {
  it('returns the verse at the given index', () => {
    expect(pickContent(sampleVerses, 0).id).toBe('001');
    expect(pickContent(sampleVerses, 1).id).toBe('002');
    expect(pickContent(sampleVerses, 2).id).toBe('003');
  });

  it('wraps around when index exceeds length', () => {
    expect(pickContent(sampleVerses, 3).id).toBe('001');
    expect(pickContent(sampleVerses, 4).id).toBe('002');
    expect(pickContent(sampleVerses, 100).id).toBe('002'); // 100 % 3 = 1
  });

  it('throws when verses array is empty', () => {
    expect(() => pickContent([], 0)).toThrow(/empty/i);
  });

  it('throws when index is negative', () => {
    expect(() => pickContent(sampleVerses, -1)).toThrow(/negative/i);
  });
});
```

- [ ] **Step 3.2: Run the test to confirm it fails**

```bash
npx vitest run tests/pickContent.test.js
```

Expected: FAIL — module not found at `src/pickContent.js`.

- [ ] **Step 3.3: Implement `pickContent`**

Create `src/pickContent.js`:

```javascript
export function pickContent(verses, index) {
  if (!Array.isArray(verses) || verses.length === 0) {
    throw new Error('verses array is empty');
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('index must be a non-negative integer');
  }
  return verses[index % verses.length];
}
```

- [ ] **Step 3.4: Run the test to confirm it passes**

```bash
npx vitest run tests/pickContent.test.js
```

Expected: PASS — 4 tests passed.

- [ ] **Step 3.5: Commit**

```bash
git add src/pickContent.js tests/pickContent.test.js
git commit -m "feat: add pickContent — deterministic verse selection by index"
```

---

## Task 4: Photo Picker — `pickPhoto.js`

**Files:**
- Create: `src/pickPhoto.js`
- Create: `tests/pickPhoto.test.js`

Given a list of photos, the verse's mood tags, and a recently-used set, returns a photo with at least one mood overlap that hasn't been used recently.

- [ ] **Step 4.1: Write the failing test**

Create `tests/pickPhoto.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { pickPhoto } from '../src/pickPhoto.js';

const samplePhotos = [
  { id: 'p1', url: 'u1', moods: ['halvet'] },
  { id: 'p2', url: 'u2', moods: ['mihrap', 'gece'] },
  { id: 'p3', url: 'u3', moods: ['halvet', 'tefekkür'] },
  { id: 'p4', url: 'u4', moods: ['seyran'] }
];

describe('pickPhoto', () => {
  it('returns a photo whose moods overlap with verse moods', () => {
    const photo = pickPhoto(samplePhotos, ['halvet'], new Set(), () => 0);
    expect(photo.moods).toContain('halvet');
  });

  it('skips recently used photo IDs', () => {
    const recentlyUsed = new Set(['p1']);
    const photo = pickPhoto(samplePhotos, ['halvet'], recentlyUsed, () => 0);
    expect(photo.id).toBe('p3');
  });

  it('falls back to recently-used if all matches are recent', () => {
    const recentlyUsed = new Set(['p1', 'p3']);
    const photo = pickPhoto(samplePhotos, ['halvet'], recentlyUsed, () => 0);
    expect(['p1', 'p3']).toContain(photo.id);
  });

  it('uses the rng to pick deterministically', () => {
    const photo = pickPhoto(samplePhotos, ['halvet'], new Set(), () => 0.99);
    expect(photo.id).toBe('p3'); // last matching
  });

  it('throws when no photo matches any mood', () => {
    expect(() => pickPhoto(samplePhotos, ['nonexistent'], new Set(), () => 0))
      .toThrow(/no photo matches/i);
  });

  it('throws when photos array is empty', () => {
    expect(() => pickPhoto([], ['halvet'], new Set(), () => 0))
      .toThrow(/empty/i);
  });
});
```

- [ ] **Step 4.2: Run the test to confirm it fails**

```bash
npx vitest run tests/pickPhoto.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement `pickPhoto`**

Create `src/pickPhoto.js`:

```javascript
export function pickPhoto(photos, verseMoods, recentlyUsed, rng = Math.random) {
  if (!Array.isArray(photos) || photos.length === 0) {
    throw new Error('photos array is empty');
  }

  const matching = photos.filter(p =>
    p.moods.some(m => verseMoods.includes(m))
  );

  if (matching.length === 0) {
    throw new Error(`no photo matches verse moods: ${verseMoods.join(', ')}`);
  }

  const fresh = matching.filter(p => !recentlyUsed.has(p.id));
  const pool = fresh.length > 0 ? fresh : matching;

  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)];
}
```

- [ ] **Step 4.4: Run the test to confirm it passes**

```bash
npx vitest run tests/pickPhoto.test.js
```

Expected: PASS — 6 tests passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/pickPhoto.js tests/pickPhoto.test.js
git commit -m "feat: add pickPhoto — mood-matched photo selection with recent-use avoidance"
```

---

## Task 5: HTML Template

**Files:**
- Create: `template/post.html`

Static HTML file with `{{placeholder}}` markers. Embedded CSS — no external stylesheet (so Playwright doesn't fetch).

- [ ] **Step 5.1: Create `template/post.html`**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>benden içeri</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1350px; overflow: hidden; }
  body {
    position: relative;
    font-family: 'Cormorant Garamond', serif;
    background: #1a1a1a;
  }
  .post-bg {
    position: absolute; inset: 0;
    background-image: url('{{photoUrl}}');
    background-size: cover;
    background-position: center;
  }
  .post-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg,
      rgba(0,0,0,0.18) 0%,
      rgba(0,0,0,0.42) 45%,
      rgba(0,0,0,0.85) 100%);
  }
  .post-content {
    position: absolute; left: 0; right: 0; bottom: 0;
    padding: 0 110px 145px;
    text-align: center;
    color: #f5efe1;
    z-index: 2;
  }
  .original {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-weight: 400;
    font-size: 48px;
    color: #d9c79a;
    margin-bottom: 42px;
    line-height: 1.5;
    opacity: 0.93;
  }
  .verse {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-weight: 500;
    font-size: 102px;
    line-height: 1.32;
    color: #faf6ec;
    margin-bottom: 60px;
    letter-spacing: 0.6px;
    white-space: pre-line;
  }
  .divider {
    width: 108px;
    height: 3px;
    background: rgba(217, 199, 154, 0.6);
    margin: 0 auto 30px;
  }
  .source {
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    font-size: 31px;
    letter-spacing: 13.5px;
    text-transform: uppercase;
    color: #d9c79a;
  }
  .hidden { display: none; }
</style>
</head>
<body>
  <div class="post-bg"></div>
  <div class="post-overlay"></div>
  <div class="post-content">
    <div class="original {{originalHidden}}">{{original}}</div>
    <div class="verse">{{verse}}</div>
    <div class="divider"></div>
    <div class="source">{{source}}</div>
  </div>
</body>
</html>
```

**Sizing math:** Mockup was at preview ~340px wide; production canvas is 1080px (3.18×). Verse 34px × 3 = ~102px in production. Original 16px × 3 = 48px. Source 10.5px × 3 = 31px. Padding 36px × 3 = ~110px sides, 48px × 3 = 144px bottom.

- [ ] **Step 5.2: Commit**

```bash
git add template/post.html
git commit -m "feat: add HTML post template with embedded CSS for 1080×1350 render"
```

---

## Task 6: HTML Template Renderer — `renderHtml.js`

**Files:**
- Create: `src/renderHtml.js`
- Create: `tests/renderHtml.test.js`

Pure function: reads template, replaces `{{placeholders}}`, returns full HTML string. Handles missing `original` (hides the element).

- [ ] **Step 6.1: Write the failing test**

Create `tests/renderHtml.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { renderHtml } from '../src/renderHtml.js';

describe('renderHtml', () => {
  it('replaces all placeholders with values', () => {
    const html = renderHtml({
      verse: 'Bir mısra',
      original: null,
      source: 'Yûnus Emre',
      photoUrl: 'https://example.com/p.jpg'
    });
    expect(html).toContain('Bir mısra');
    expect(html).toContain('Yûnus Emre');
    expect(html).toContain('https://example.com/p.jpg');
    expect(html).not.toContain('{{verse}}');
    expect(html).not.toContain('{{photoUrl}}');
  });

  it('hides the original element when original is null', () => {
    const html = renderHtml({
      verse: 'X', original: null, source: 'Y', photoUrl: 'u'
    });
    expect(html).toMatch(/class="original hidden"/);
  });

  it('shows the original element when present', () => {
    const html = renderHtml({
      verse: 'X', original: '"Dil ber"', source: 'Y', photoUrl: 'u'
    });
    expect(html).toContain('"Dil ber"');
    expect(html).toMatch(/class="original "/);
  });

  it('preserves newlines in verse via white-space CSS', () => {
    const html = renderHtml({
      verse: 'line one\nline two',
      original: null,
      source: 'X',
      photoUrl: 'u'
    });
    expect(html).toContain('line one\nline two');
  });

  it('escapes nothing — verses are trusted curated content', () => {
    const html = renderHtml({
      verse: 'tek "tırnak" içinde',
      original: null,
      source: 'X',
      photoUrl: 'u'
    });
    expect(html).toContain('tek "tırnak" içinde');
  });
});
```

- [ ] **Step 6.2: Run the test to confirm it fails**

```bash
npx vitest run tests/renderHtml.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement `renderHtml`**

Create `src/renderHtml.js`:

```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', 'template', 'post.html');

export function renderHtml({ verse, original, source, photoUrl }) {
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');

  return template
    .replace('{{verse}}', verse)
    .replace('{{original}}', original ?? '')
    .replace('{{originalHidden}}', original ? '' : 'hidden')
    .replace('{{source}}', source)
    .replace('{{photoUrl}}', photoUrl);
}
```

- [ ] **Step 6.4: Run the test to confirm it passes**

```bash
npx vitest run tests/renderHtml.test.js
```

Expected: PASS — 5 tests passed.

- [ ] **Step 6.5: Commit**

```bash
git add src/renderHtml.js tests/renderHtml.test.js
git commit -m "feat: add renderHtml — fills HTML template with verse data"
```

---

## Task 7: PNG Renderer — `render.js` (Playwright integration)

**Files:**
- Create: `src/render.js`
- Create: `tests/render.test.js`

Side-effect function: takes data + output path, launches headless Chromium, screenshots HTML at 1080×1350, writes PNG.

- [ ] **Step 7.1: Write the integration test**

Create `tests/render.test.js`:

```javascript
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, statSync, unlinkSync } from 'node:fs';
import { renderToPng } from '../src/render.js';

const TEST_OUTPUT = './output/test-render.png';

describe('renderToPng', () => {
  afterEach(() => {
    if (existsSync(TEST_OUTPUT)) unlinkSync(TEST_OUTPUT);
  });

  it('writes a valid PNG file with correct dimensions', async () => {
    await renderToPng({
      verse: 'Test verse',
      original: null,
      source: 'Test',
      photoUrl: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=1200&q=85'
    }, TEST_OUTPUT);

    expect(existsSync(TEST_OUTPUT)).toBe(true);
    const stats = statSync(TEST_OUTPUT);
    expect(stats.size).toBeGreaterThan(50_000); // PNG should be at least 50KB
  }, 30_000); // 30s timeout for browser startup
});
```

- [ ] **Step 7.2: Run the test to confirm it fails**

```bash
npx vitest run tests/render.test.js
```

Expected: FAIL — module not found at `src/render.js`.

- [ ] **Step 7.3: Implement `renderToPng`**

Create `src/render.js`:

```javascript
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
```

- [ ] **Step 7.4: Run the test to confirm it passes**

```bash
npx vitest run tests/render.test.js
```

Expected: PASS in ~5-10 seconds. PNG file created at `output/test-render.png`.

- [ ] **Step 7.5: Visual sanity check**

```bash
open output/test-render.png
```

(or whatever image viewer command). Verify: 1080×1350, dark photo with cream verse "Test verse" centered lower, "TEST" in caps with letter spacing below a thin gold line.

- [ ] **Step 7.6: Commit**

```bash
git add src/render.js tests/render.test.js
git commit -m "feat: add renderToPng — Playwright HTML→PNG at 1080×1350"
```

---

## Task 8: Instagram API Client — `postToInstagram.js`

**Files:**
- Create: `src/postToInstagram.js`
- Create: `tests/postToInstagram.test.js`

Two-step Graph API: create media container, then publish. Uses `globalThis.fetch` (Node 20+).

- [ ] **Step 8.1: Write the failing test**

Create `tests/postToInstagram.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postToInstagram } from '../src/postToInstagram.js';

describe('postToInstagram', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a media container then publishes it', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'container-123' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'post-456' })
      });
    vi.stubGlobal('fetch', mockFetch);

    const result = await postToInstagram({
      igUserId: 'IG_USER',
      accessToken: 'TOKEN_X',
      imageUrl: 'https://example.com/img.png',
      caption: 'A caption'
    });

    expect(result.postId).toBe('post-456');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall[0]).toContain('IG_USER/media');
    expect(firstCall[0]).toContain('access_token=TOKEN_X');
    expect(firstCall[0]).toContain('image_url=https');
    const secondCall = mockFetch.mock.calls[1];
    expect(secondCall[0]).toContain('IG_USER/media_publish');
    expect(secondCall[0]).toContain('creation_id=container-123');
  });

  it('throws when container creation fails', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad image URL' } })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(postToInstagram({
      igUserId: 'X', accessToken: 'Y',
      imageUrl: 'bad', caption: 'c'
    })).rejects.toThrow(/Bad image URL/);
  });

  it('throws when publish fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'container-1' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'IG server error' } })
      });
    vi.stubGlobal('fetch', mockFetch);

    await expect(postToInstagram({
      igUserId: 'X', accessToken: 'Y',
      imageUrl: 'u', caption: 'c'
    })).rejects.toThrow(/IG server error/);
  });
});
```

- [ ] **Step 8.2: Run the test to confirm it fails**

```bash
npx vitest run tests/postToInstagram.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 8.3: Implement `postToInstagram`**

Create `src/postToInstagram.js`:

```javascript
const API_BASE = 'https://graph.facebook.com/v21.0';

export async function postToInstagram({ igUserId, accessToken, imageUrl, caption }) {
  // Step 1: create media container
  const containerUrl = new URL(`${API_BASE}/${igUserId}/media`);
  containerUrl.searchParams.set('image_url', imageUrl);
  containerUrl.searchParams.set('caption', caption);
  containerUrl.searchParams.set('access_token', accessToken);

  const containerRes = await fetch(containerUrl, { method: 'POST' });
  if (!containerRes.ok) {
    const err = await containerRes.json().catch(() => ({}));
    throw new Error(`Container creation failed: ${err.error?.message || containerRes.statusText}`);
  }
  const { id: containerId } = await containerRes.json();

  // Step 2: publish
  const publishUrl = new URL(`${API_BASE}/${igUserId}/media_publish`);
  publishUrl.searchParams.set('creation_id', containerId);
  publishUrl.searchParams.set('access_token', accessToken);

  const publishRes = await fetch(publishUrl, { method: 'POST' });
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    throw new Error(`Publish failed: ${err.error?.message || publishRes.statusText}`);
  }
  const { id: postId } = await publishRes.json();

  return { postId, containerId };
}
```

- [ ] **Step 8.4: Run the test to confirm it passes**

```bash
npx vitest run tests/postToInstagram.test.js
```

Expected: PASS — 3 tests passed.

- [ ] **Step 8.5: Commit**

```bash
git add src/postToInstagram.js tests/postToInstagram.test.js
git commit -m "feat: add postToInstagram — IG Graph API 2-step container + publish"
```

---

## Task 9: Orchestrator — `index.js`

**Files:**
- Create: `src/index.js`
- Create: `src/state.js` (read/write `output/log.json`)
- Create: `tests/state.test.js`
- Create: `tests/index.test.js`

State file `output/log.json` tracks: launch date, last post date, recently used photo IDs (last 14). Index = days since launch.

- [ ] **Step 9.1: Write `state.js` test**

Create `tests/state.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { readState, writeState, daysSinceLaunch } from '../src/state.js';

const TEST_PATH = './output/test-log.json';

describe('state', () => {
  beforeEach(() => {
    mkdirSync('./output', { recursive: true });
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
  });
  afterEach(() => {
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
  });

  it('readState returns default when file missing', () => {
    const s = readState(TEST_PATH);
    expect(s.launchDate).toBeNull();
    expect(s.lastPost).toBeNull();
    expect(s.recentPhotos).toEqual([]);
  });

  it('writeState then readState roundtrips', () => {
    writeState(TEST_PATH, {
      launchDate: '2026-04-27',
      lastPost: { date: '2026-04-27', verseId: '001', photoId: 'p1' },
      recentPhotos: ['p1', 'p2']
    });
    const s = readState(TEST_PATH);
    expect(s.launchDate).toBe('2026-04-27');
    expect(s.lastPost.verseId).toBe('001');
    expect(s.recentPhotos).toEqual(['p1', 'p2']);
  });

  it('daysSinceLaunch counts days from launch to today', () => {
    expect(daysSinceLaunch('2026-04-27', '2026-04-27')).toBe(0);
    expect(daysSinceLaunch('2026-04-27', '2026-04-28')).toBe(1);
    expect(daysSinceLaunch('2026-04-27', '2026-05-27')).toBe(30);
  });
});
```

- [ ] **Step 9.2: Run test to confirm fail**

```bash
npx vitest run tests/state.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 9.3: Implement `state.js`**

Create `src/state.js`:

```javascript
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DEFAULT_STATE = {
  launchDate: null,
  lastPost: null,
  recentPhotos: []
};

export function readState(path) {
  if (!existsSync(path)) return { ...DEFAULT_STATE };
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function writeState(path, state) {
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function daysSinceLaunch(launchDate, today) {
  const a = new Date(launchDate + 'T00:00:00Z');
  const b = new Date(today + 'T00:00:00Z');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 9.4: Run test to confirm pass**

```bash
npx vitest run tests/state.test.js
```

Expected: PASS — 3 tests passed.

- [ ] **Step 9.5: Commit `state.js`**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat: add state module — log.json read/write + daysSinceLaunch"
```

- [ ] **Step 9.6: Write `index.js` test**

Create `tests/index.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { runDaily } from '../src/index.js';

describe('runDaily', () => {
  it('orchestrates pick → render → post and updates state', async () => {
    const verses = [
      { id: '001', verse: 'V1', source: 'S1', moods: ['halvet'], caption: 'c1' }
    ];
    const photos = [
      { id: 'p1', url: 'https://example.com/1.jpg', moods: ['halvet'] }
    ];
    const renderMock = vi.fn().mockResolvedValue('/tmp/out.png');
    const uploadMock = vi.fn().mockResolvedValue('https://cdn/1.png');
    const postMock = vi.fn().mockResolvedValue({ postId: 'IG-1' });

    const state = { launchDate: '2026-04-27', lastPost: null, recentPhotos: [] };

    const result = await runDaily({
      verses, photos, state,
      today: '2026-04-27',
      render: renderMock,
      upload: uploadMock,
      post: postMock,
      env: { igUserId: 'X', accessToken: 'Y' }
    });

    expect(renderMock).toHaveBeenCalledOnce();
    expect(uploadMock).toHaveBeenCalledOnce();
    expect(postMock).toHaveBeenCalledOnce();
    expect(result.newState.lastPost.verseId).toBe('001');
    expect(result.newState.lastPost.postId).toBe('IG-1');
    expect(result.newState.recentPhotos).toContain('p1');
  });

  it('initializes launchDate when null', async () => {
    const verses = [{ id: '001', verse: 'V', source: 'S', moods: ['halvet'], caption: 'c' }];
    const photos = [{ id: 'p1', url: 'u', moods: ['halvet'] }];

    const result = await runDaily({
      verses, photos,
      state: { launchDate: null, lastPost: null, recentPhotos: [] },
      today: '2026-04-27',
      render: vi.fn().mockResolvedValue('/p'),
      upload: vi.fn().mockResolvedValue('https://cdn/x.png'),
      post: vi.fn().mockResolvedValue({ postId: 'X' }),
      env: { igUserId: 'X', accessToken: 'Y' }
    });

    expect(result.newState.launchDate).toBe('2026-04-27');
  });

  it('limits recentPhotos to 14 most recent', async () => {
    const verses = [{ id: '001', verse: 'V', source: 'S', moods: ['halvet'], caption: 'c' }];
    const photos = [{ id: 'p-new', url: 'u', moods: ['halvet'] }];

    const oldRecent = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const result = await runDaily({
      verses, photos,
      state: { launchDate: '2026-04-27', lastPost: null, recentPhotos: oldRecent },
      today: '2026-04-27',
      render: vi.fn().mockResolvedValue('/p'),
      upload: vi.fn().mockResolvedValue('https://cdn/x.png'),
      post: vi.fn().mockResolvedValue({ postId: 'X' }),
      env: { igUserId: 'X', accessToken: 'Y' }
    });

    expect(result.newState.recentPhotos.length).toBe(14);
    expect(result.newState.recentPhotos).toContain('p-new');
    expect(result.newState.recentPhotos).not.toContain('p0');
  });
});
```

- [ ] **Step 9.7: Run test to confirm fail**

```bash
npx vitest run tests/index.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 9.8: Implement `index.js`**

Create `src/index.js`:

```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickContent } from './pickContent.js';
import { pickPhoto } from './pickPhoto.js';
import { renderToPng } from './render.js';
import { postToInstagram } from './postToInstagram.js';
import { readState, writeState, daysSinceLaunch } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export async function runDaily({
  verses, photos, state, today,
  render, upload, post, env
}) {
  const launchDate = state.launchDate ?? today;
  const dayIndex = daysSinceLaunch(launchDate, today);

  const verse = pickContent(verses, dayIndex);
  const recentlyUsed = new Set(state.recentPhotos);
  const photo = pickPhoto(photos, verse.moods, recentlyUsed);

  const outputPath = join(ROOT, 'output', `${today}.png`);
  await render({
    verse: verse.verse,
    original: verse.original,
    source: verse.source,
    photoUrl: photo.url
  }, outputPath);

  const publicUrl = await upload(outputPath, today);

  const result = await post({
    igUserId: env.igUserId,
    accessToken: env.accessToken,
    imageUrl: publicUrl,
    caption: verse.caption
  });

  const newRecent = [photo.id, ...state.recentPhotos.filter(id => id !== photo.id)].slice(0, 14);

  return {
    newState: {
      launchDate,
      lastPost: {
        date: today,
        verseId: verse.id,
        photoId: photo.id,
        postId: result.postId
      },
      recentPhotos: newRecent
    },
    outputPath,
    publicUrl,
    postId: result.postId
  };
}

export async function main() {
  const verses = JSON.parse(readFileSync(join(ROOT, 'content', 'verses.json'), 'utf-8'));
  const photos = JSON.parse(readFileSync(join(ROOT, 'content', 'photos.json'), 'utf-8'));
  const statePath = join(ROOT, 'output', 'log.json');
  const state = readState(statePath);

  const today = new Date().toISOString().slice(0, 10);

  // Default upload: GitHub raw URL based on env
  const uploadFn = async (filePath, dateStr) => {
    const repo = process.env.GITHUB_REPOSITORY;
    const branch = process.env.GITHUB_REF_NAME ?? 'main';
    if (!repo) throw new Error('GITHUB_REPOSITORY env var required');
    return `https://raw.githubusercontent.com/${repo}/${branch}/output/${dateStr}.png`;
  };

  const result = await runDaily({
    verses, photos, state, today,
    render: renderToPng,
    upload: uploadFn,
    post: postToInstagram,
    env: {
      igUserId: process.env.IG_USER_ID,
      accessToken: process.env.IG_ACCESS_TOKEN
    }
  });

  writeState(statePath, result.newState);
  console.log(`✓ Posted ${result.postId}: ${result.publicUrl}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('FAIL:', err.message);
    process.exit(1);
  });
}
```

- [ ] **Step 9.9: Run test to confirm pass**

```bash
npx vitest run tests/index.test.js
```

Expected: PASS — 3 tests passed.

- [ ] **Step 9.10: Run full test suite**

```bash
npx vitest run
```

Expected: ALL PASS — pickContent, pickPhoto, renderHtml, render (integration), postToInstagram, state, index. ~15 tests total.

- [ ] **Step 9.11: Commit**

```bash
git add src/index.js tests/index.test.js
git commit -m "feat: add runDaily orchestrator + main entry with GitHub raw URL upload"
```

---

## Task 10: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/daily.yml`

Cron at 09:00 GMT+3 = 06:00 UTC. Also `workflow_dispatch` for manual trigger.

- [ ] **Step 10.1: Create the workflow**

Create `.github/workflows/daily.yml`:

```yaml
name: Daily Post

on:
  schedule:
    - cron: '0 6 * * *'  # 06:00 UTC = 09:00 GMT+3
  workflow_dispatch:      # manual trigger button

permissions:
  contents: write         # needed to commit output PNG and log.json back

jobs:
  post:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Generate today's PNG
        run: npm run render
        env:
          IG_USER_ID: ${{ secrets.IG_USER_ID }}
          IG_ACCESS_TOKEN: ${{ secrets.IG_ACCESS_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          GITHUB_REF_NAME: ${{ github.ref_name }}

      - name: Commit and push generated PNG + state
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git add output/
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "chore: daily post $(date -u +%Y-%m-%d)"
            git push
          fi

      - name: Wait for raw URL availability
        run: sleep 10

      - name: Post to Instagram
        run: npm run post
        env:
          IG_USER_ID: ${{ secrets.IG_USER_ID }}
          IG_ACCESS_TOKEN: ${{ secrets.IG_ACCESS_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          GITHUB_REF_NAME: ${{ github.ref_name }}
```

**Note:** The current `index.js` has `render` and `post` as a single `daily` action. The workflow needs the script split into render+commit+post phases. We'll add scripts for that.

- [ ] **Step 10.2: Update `package.json` scripts**

Replace the `scripts` block in `package.json`:

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "daily": "node src/index.js daily",
    "render": "node src/cli-render.js",
    "post": "node src/cli-post.js"
  },
```

- [ ] **Step 10.3: Create `src/cli-render.js`**

```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickContent } from './pickContent.js';
import { pickPhoto } from './pickPhoto.js';
import { renderToPng } from './render.js';
import { readState, writeState, daysSinceLaunch } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const verses = JSON.parse(readFileSync(join(ROOT, 'content', 'verses.json'), 'utf-8'));
const photos = JSON.parse(readFileSync(join(ROOT, 'content', 'photos.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);
const today = new Date().toISOString().slice(0, 10);
const launchDate = state.launchDate ?? today;
const dayIndex = daysSinceLaunch(launchDate, today);

const verse = pickContent(verses, dayIndex);
const photo = pickPhoto(photos, verse.moods, new Set(state.recentPhotos));
const outputPath = join(ROOT, 'output', `${today}.png`);

await renderToPng({
  verse: verse.verse,
  original: verse.original,
  source: verse.source,
  photoUrl: photo.url
}, outputPath);

// Update state with selection (post step finalizes with postId)
writeState(statePath, {
  launchDate,
  lastPost: { date: today, verseId: verse.id, photoId: photo.id, postId: null },
  recentPhotos: [photo.id, ...state.recentPhotos.filter(id => id !== photo.id)].slice(0, 14)
});

console.log(`✓ Rendered ${outputPath} (verse ${verse.id}, photo ${photo.id})`);
```

- [ ] **Step 10.4: Create `src/cli-post.js`**

```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { postToInstagram } from './postToInstagram.js';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const verses = JSON.parse(readFileSync(join(ROOT, 'content', 'verses.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);

if (!state.lastPost || !state.lastPost.date) {
  throw new Error('No pending post in state. Run npm run render first.');
}

const verse = verses.find(v => v.id === state.lastPost.verseId);
if (!verse) throw new Error(`Verse ${state.lastPost.verseId} not found`);

const repo = process.env.GITHUB_REPOSITORY;
const branch = process.env.GITHUB_REF_NAME ?? 'main';
if (!repo) throw new Error('GITHUB_REPOSITORY env var required');

const imageUrl = `https://raw.githubusercontent.com/${repo}/${branch}/output/${state.lastPost.date}.png`;

const result = await postToInstagram({
  igUserId: process.env.IG_USER_ID,
  accessToken: process.env.IG_ACCESS_TOKEN,
  imageUrl,
  caption: verse.caption
});

writeState(statePath, {
  ...state,
  lastPost: { ...state.lastPost, postId: result.postId }
});

console.log(`✓ Posted ${result.postId}: ${imageUrl}`);
```

- [ ] **Step 10.5: Verify everything still passes**

```bash
npx vitest run
```

Expected: ALL PASS.

- [ ] **Step 10.6: Commit workflow + CLI scripts**

```bash
git add .github/ src/cli-render.js src/cli-post.js package.json
git commit -m "feat: add GitHub Actions daily workflow + render/post CLI scripts"
```

---

## Task 11: README and Setup Documentation

**Files:**
- Create: `README.md`
- Create: `docs/META_APP_SETUP.md`

- [ ] **Step 11.1: Create `README.md`**

```markdown
# benden içeri

Otomatik günlük tasavvuf paylaşımları için Instagram automation.

Her gün 09:00'da (GMT+3) GitHub Actions, `content/verses.json`'dan sıradaki mısrayı seçer, `content/photos.json`'dan uygun mood'da bir fotoğraf eşleştirir, Cormorant Italic + dark overlay ile 1080×1350 PNG render eder ve Instagram Graph API üzerinden @benden.iceri'ye postlar.

**Maliyet:** $0/ay forever. **Mac açık olması gerekmez.**

## Geliştirme

### Önkoşul

- Node.js 20+ (`.nvmrc`)
- npm

### Kurulum

```bash
npm install
npx playwright install chromium
```

### Test

```bash
npm test
```

### Yerel render

```bash
npm run render
open output/$(date -u +%Y-%m-%d).png
```

## Deployment

### 1. GitHub repo

```bash
gh repo create benden-iceri --public --source=. --push
```

(Public öneriliyor — Actions'ın free quota'sı sınırsız oluyor + raw URL erişimi açık.)

### 2. Instagram + Meta App kurulumu

Detaylı talimat: [docs/META_APP_SETUP.md](docs/META_APP_SETUP.md)

Kısaca:
1. Instagram hesabını **Business** veya **Creator** hesaba çevir
2. Bir Facebook Page oluştur, Instagram hesabını bağla
3. Meta Developer'da app oluştur, Instagram Graph API izinleri al
4. Long-lived access token üret (60 gün)

### 3. GitHub Secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Değer |
|---|---|
| `IG_USER_ID` | Instagram Graph API'den dönen Business hesabının ID'si |
| `IG_ACCESS_TOKEN` | Long-lived access token |

### 4. İlk test

Repo → Actions sekmesi → "Daily Post" workflow → "Run workflow" butonu (workflow_dispatch).

İlk çalışmadan sonra:
- `output/YYYY-MM-DD.png` repo'ya commit edilir
- Instagram hesabında post görünmelidir
- Action log'unda "✓ Posted IG-..." mesajı

### 5. Otomatik akış

Schedule kurulu — her gün 06:00 UTC (09:00 GMT+3) otomatik çalışır.

## İçerik ekleme

Yeni mısra eklemek için `content/verses.json`'a JSON entry ekle, PR aç, merge et.

Her entry:

```json
{
  "id": "020",
  "verse": "Mısra burada (\\n ile satır kırıkları)",
  "original": null,
  "source": "Niyazî-i Mısrî",
  "moods": ["halvet", "tefekkür"],
  "format": "A",
  "caption": "post açıklaması 🌙\n\n#niyazimisri",
  "verified": true
}
```

Mood listesi (`content/photos.json` ile uyumlu):
- `halvet`, `ic-dunya`, `seyran`, `ask-yangini`, `yalnizlik`, `mihrap`, `divan`, `gece`, `tefekkür`

## Sorun giderme

- **Action başarısız:** Repo → Actions → ilgili çalıştırma → log'a bak.
- **Token süresi doldu:** [META_APP_SETUP.md](docs/META_APP_SETUP.md) Token Refresh bölümü.
- **Yanlış post yayınlandı:** Manuel sil. `output/log.json`'da `lastPost.postId`'yi bul, IG'de sil. PR ile düzelt.
```

- [ ] **Step 11.2: Create `docs/META_APP_SETUP.md`**

```markdown
# Meta Developer App + Instagram Graph API Setup

Bir kerelik kurulum. ~30-60 dakika sürer.

## 1. Instagram Hesabını Business'e Çevir

1. Instagram uygulamasından @benden.iceri profiline git
2. Settings → Account → "Switch to Professional Account"
3. Business veya Creator seç (her ikisi de Graph API'sine erişiyor)

## 2. Facebook Page Oluştur ve Bağla

1. https://www.facebook.com/pages/create
2. "Brand or Product" → "benden içeri" adıyla
3. Page Settings → Linked Accounts → Instagram → @benden.iceri ile bağla

## 3. Meta Developer App

1. https://developers.facebook.com/apps/ → "Create App"
2. App type: "Business"
3. Use case: "Other" → "Business"
4. App'in dashboard'unda:
   - "Add Product" → **Instagram** ve **Facebook Login for Business**

## 4. Permission'lar

App Review → Permissions and Features:

İhtiyacımız olan:
- `instagram_basic` (read)
- `instagram_content_publish` (post)
- `pages_show_list` (FB Page listesi)
- `pages_read_engagement` (FB Page detayı)

İlk testler için **Test User** olarak çalışıyor — App Review olmadan kendi hesabınla test edebilirsin. Production'a geçince Permissions tab'ından review başlatılır (1-7 gün).

## 5. Access Token

### Short-lived → Long-lived

1. Graph API Explorer: https://developers.facebook.com/tools/explorer/
2. App'i seç, "User Token" + permission'ları işaretle ("Generate Access Token")
3. Bu kısa ömürlü token (1 saat)

Long-lived'e çevir (60 gün):

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}"
```

Çıktıdan `access_token` field'i — bu uzun ömürlü token.

### Page Token (kalıcı)

User token long-lived olsa da Page Access Token aslında **kalıcı** (Page bağlı kaldıkça).

```bash
curl -X GET "https://graph.facebook.com/v21.0/me/accounts?access_token={LONG_USER_TOKEN}"
```

Çıktıdaki Page'in `access_token` değeri — bunu GitHub Secret olarak kullan.

## 6. IG Business Account ID Bulma

```bash
curl -X GET "https://graph.facebook.com/v21.0/{PAGE_ID}?fields=instagram_business_account&access_token={PAGE_TOKEN}"
```

Çıktı: `{"instagram_business_account": {"id": "1789..."}}` — bu ID'yi `IG_USER_ID` Secret'a yaz.

## 7. Test

```bash
# imageUrl public erişilebilir olmalı
curl -X POST "https://graph.facebook.com/v21.0/{IG_USER_ID}/media?image_url=https://example.com/test.jpg&caption=test&access_token={TOKEN}"

# yanıt: {"id": "container-id"}
# sonra yayınla:
curl -X POST "https://graph.facebook.com/v21.0/{IG_USER_ID}/media_publish?creation_id={container-id}&access_token={TOKEN}"
```

Başarılıysa Instagram'da post görünür.

## 8. Token Refresh (Faz 2)

User long-lived token 60 günde bir yenilenmeli. Page token kalıcı (Page bağlı kaldıkça) ama refresh önerilir.

Faz 2'de bir GitHub Action eklenecek: 50 günde bir tokenı otomatik refresh eder. Şimdilik manuel olarak 50 günde bir adım 5'i tekrar et.

## Yararlı Linkler

- IG Graph API: https://developers.facebook.com/docs/instagram-api
- Content Publishing: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
- Token Debugger: https://developers.facebook.com/tools/debug/accesstoken/
```

- [ ] **Step 11.3: Commit docs**

```bash
git add README.md docs/META_APP_SETUP.md
git commit -m "docs: add README + Meta App setup guide"
```

---

## Task 12: First Live Deployment Test (Manual — User Action Required)

**Files:** None (manual operation)

This task is partly manual — the user must complete Meta App setup and configure GitHub Secrets. Then we run the first live test.

- [ ] **Step 12.1: Create GitHub repo**

User runs:

```bash
gh repo create benden-iceri --public --source=. --push
```

- [ ] **Step 12.2: Complete Meta App setup**

User follows `docs/META_APP_SETUP.md` step-by-step:
1. Instagram → Business hesap
2. Facebook Page → bağla
3. Meta Developer App → oluştur
4. Permission'ları al
5. Long-lived access token üret
6. IG Business Account ID öğren

- [ ] **Step 12.3: Add GitHub Secrets**

User: GitHub repo → Settings → Secrets and variables → Actions → "New repository secret":

- `IG_USER_ID` = step 12.2'den çıkan IG Business Account ID
- `IG_ACCESS_TOKEN` = step 12.2'den çıkan long-lived Page Access Token

- [ ] **Step 12.4: Manual workflow_dispatch**

GitHub repo → Actions → "Daily Post" workflow → "Run workflow" → main branch → Run.

Expected:
- Action runs ~3-5 minutes
- Steps: checkout → setup → npm ci → playwright install → render → commit → wait → post → ✓ Posted IG-... in logs
- Repo: new commit "chore: daily post YYYY-MM-DD" with `output/YYYY-MM-DD.png`
- Instagram: post visible on @benden.iceri

- [ ] **Step 12.5: Visual + content verification**

User opens Instagram app, checks:
- Post visible
- Image renders correctly (no broken layout)
- Caption shows
- Tags work

If post fails, check Action logs. Common issues:
- Token expired/invalid → refresh per `META_APP_SETUP.md`
- Image URL not yet available → increase `sleep` in workflow
- Container creation 400 → check image is publicly accessible (test raw URL in browser)

- [ ] **Step 12.6: Confirm cron triggers next day**

Wait until next day 09:00 GMT+3. GitHub Actions tab should show automatic run. Instagram should have new post.

If yes: **MVP complete.** ✓

---

## Self-Review

**Spec coverage check:**
- §1.1 Account name → README mentions @benden.iceri
- §1.4 Bio → not in MVP code (manual setup, mentioned in spec)
- §2.1 Sources → seed verses cover Niyazî, Salih Baba, Bahâeddin Nakşbend ✓
- §2.2 Formats A/B/C → verses.json supports `format` field, template renders A and C; format D (carousel) deferred to Phase 2 per §8 ✓
- §2.3 Style rules → respected in seed captions (no "tasavvuf"/"tarikat"/"Nakşî" in feed display)
- §3 Visual identity → template/post.html has all specs (palette, fonts, sizes, divider, no watermark) ✓
- §4 Architecture → Tasks 1-10 implement full stack ✓
- §5 Photo strategy → photos.json with mood tags ✓
- §6 Differentiation → addressed via verse curation + photo selection (mood emphasis on halvet/ic-dunya) ✓
- §7 Modules → all created in Tasks 3-9 ✓
- §8 Phase 1 → all checkboxes from spec covered in Tasks 1-12 ✓
- §9 Risks → README troubleshooting + META_APP_SETUP token refresh ✓
- §10 Open questions → not blocking; resolved iteratively post-launch

**Placeholder scan:** No "TBD", no "TODO", no "implement later". All steps have concrete code.

**Type consistency:** `verses.json` shape matches `pickContent`'s usage. `photos.json` shape matches `pickPhoto`. `state.json` shape matches `state.js`. `runDaily` signature matches `cli-render.js` + `cli-post.js` usage of the underlying primitives. Workflow env vars (`IG_USER_ID`, `IG_ACCESS_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_REF_NAME`) all consistent.

**Scope:** MVP is a single coherent project, ~12 tasks, ~3-5 hours of agentic work + ~30-60 min user manual setup. Reasonable single-plan scope.

---

## Phase 2 Readiness (Future Work — Not in This Plan)

Once MVP runs stable for 1-2 weeks:

- Token auto-refresh GitHub Action
- 90-day verses.json (50+ verified entries)
- 100 photos.json
- Carousel format (D)
- Hashtag strategy optimization
- Old PNG cleanup script (delete >30 day old PNGs from output/)
- Optional: Stories cross-posting
- Optional: switch raw URL → ImgBB or Cloudinary if reliability issues
