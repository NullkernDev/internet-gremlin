/**
 * Renders promotional artwork with headless Chrome from HTML compositions.
 * Every creature is drawn by the real sprite renderer, so the art is on-model.
 *
 *   npm run promo
 *
 * Outputs:
 *   assets/hero.png                       README hero (1280×640)
 *   assets/expressions-sheet.png          the 15 required expressions
 *   assets/stickers/*.png                 reaction stickers (512×512)
 *   promo/store/marquee-1400x560.png      store marquee
 *   promo/store/small-tile-440x280.png    store small tile
 *   promo/store/screenshot-*.png          store screenshots (1280×800), framed from
 *                                         real captures in assets/screenshots/
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { CORE_EXPRESSIONS, EXPRESSION_LABELS, renderSprite, type Arms, type Expression } from '../src/sprite/sprite';

const root = resolve(import.meta.dirname, '..');
const chromePath = process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const work = join(root, '.scratch/promo');
mkdirSync(work, { recursive: true });
for (const d of ['assets/stickers', 'promo/store']) mkdirSync(join(root, d), { recursive: true });

const MIME: Record<string, string> = { '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const sprite = (e: Expression, scale: number, opts: { arms?: Arms; golden?: boolean; lookX?: -1 | 0 | 1; lookY?: -1 | 0 | 1 } = {}) => renderSprite({ expression: e, ...opts }, scale);

const BASE_CSS = `
@font-face { font-family: Pixel; src: url('/public/fonts/pixelify-sans-latin-400-normal.woff2'); font-weight: 400; }
@font-face { font-family: Pixel; src: url('/public/fonts/pixelify-sans-latin-700-normal.woff2'); font-weight: 700; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: Pixel, monospace; color: #fff; overflow: hidden; -webkit-font-smoothing: none; }
.sky { position: absolute; inset: 0; background: url('/public/img/sky.png') center / cover; image-rendering: pixelated; }
svg { display: block; image-rendering: pixelated; }
.win { position: absolute; background: #f6f1ff; color: #1c1230; box-shadow: 0 -3px 0 #1c1230, 0 3px 0 #1c1230, -3px 0 0 #1c1230, 3px 0 0 #1c1230, 8px 10px 0 rgba(0,0,0,.35); }
.win .t { display: flex; align-items: center; gap: 7px; padding: 4px 7px; background: linear-gradient(90deg,#7a52e0,#a982ff); color: #fff; font-weight: 700; font-size: 13px; letter-spacing: .08em; border-bottom: 3px solid #1c1230; text-transform: uppercase; }
.win .t i { width: 8px; height: 8px; box-shadow: 0 0 0 2px #1c1230; display: inline-block; }
.win .t i:nth-child(1) { background: #ff4f9a; } .win .t i:nth-child(2) { background: #fff36b; } .win .t i:nth-child(3) { background: #b8ff3c; }
.win .b { display: grid; place-items: center; }
.title { font-weight: 700; letter-spacing: .04em; text-shadow: 6px 6px 0 #7a52e0; line-height: .95; }
.title span { color: #b8ff3c; }
.tag { color: #e6d9ff; }
.chip { display: inline-block; padding: 4px 10px; background: #b8ff3c; color: #1c1230; box-shadow: 0 0 0 3px #1c1230; font-weight: 700; }
`;

function win(title: string, body: string, x: number, y: number, w: number, h: number, bg = '#f6f1ff', extra = '') {
  return `<div class="win" style="left:${x}px;top:${y}px;width:${w}px;${extra}"><div class="t"><i></i><i></i><i></i><span>${title}</span></div><div class="b" style="height:${h}px;background:${bg}">${body}</div></div>`;
}

function page(w: number, h: number, body: string, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}body{width:${w}px;height:${h}px;position:relative}${css}</style></head><body>${body}</body></html>`;
}

const bubble = (text: string, x: number, y: number, size = 18, maxW = 300) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;max-width:${maxW}px;padding:10px 14px;background:#fffdf6;color:#1c1230;font-size:${size}px;box-shadow:0 -3px 0 #1c1230,0 3px 0 #1c1230,-3px 0 0 #1c1230,3px 0 0 #1c1230,5px 7px 0 rgba(0,0,0,.3)">${text}</div>`;

// ------------------------------------------------------------------ compositions
const jobs: { name: string; out: string; w: number; h: number; html: string; transparent?: boolean }[] = [];

// README hero — an homage to cluttered pixel desktops: creatures in little windows.
jobs.push({
  name: 'hero',
  out: 'assets/hero.png',
  w: 1280,
  h: 640,
  html: page(
    1280,
    640,
    `<div class="sky"></div>
    ${win('happy.exe', sprite('happy', 3), 70, 70, 150, 120, '#ffd6ec')}
    ${win('suspicious.exe', sprite('suspicious', 3), 1040, 60, 170, 120, '#d4f7ff')}
    ${win('love.exe', sprite('love', 3), 1080, 430, 160, 120, '#fff6b8')}
    ${win('crying.exe', sprite('crying', 3), 40, 440, 160, 120, '#dfffc4')}
    ${win('evil.exe', sprite('evil', 2, { arms: 'hold' }), 290, 250, 110, 84, '#e6d9ff')}
    ${win('dizzy.exe', sprite('dizzy', 2), 870, 260, 110, 84, '#ffd6ec')}
    <div style="position:absolute;left:0;right:0;top:118px;display:grid;justify-items:center">
      ${sprite('neutral', 9, { lookX: 1, lookY: 1 })}
      <div class="title" style="font-size:86px;margin-top:20px">INTERNET <span>GREMLIN</span></div>
      <div class="tag" style="font-size:30px;margin-top:12px;text-shadow:3px 3px 0 #1c1230">Your browser. Its territory. Your problem.</div>
    </div>
    ${bubble('I have seen things in these tabs.', 776, 128, 19, 230)}`,
  ),
});

// Store marquee 1400×560
jobs.push({
  name: 'marquee',
  out: 'promo/store/marquee-1400x560.png',
  w: 1400,
  h: 560,
  html: page(
    1400,
    560,
    `<div class="sky"></div>
    <div style="position:absolute;left:90px;top:120px;width:640px">
      <div class="title" style="font-size:92px">INTERNET<br><span>GREMLIN</span></div>
      <div class="tag" style="font-size:30px;margin-top:22px;text-shadow:3px 3px 0 #1c1230">Your browser. Its territory. Your problem.</div>
      <div style="margin-top:26px;display:flex;gap:14px"><span class="chip">100% offline</span><span class="chip" style="background:#ff4f9a;color:#fff">15 moods</span><span class="chip" style="background:#fff36b">17 secrets</span></div>
    </div>
    <div style="position:absolute;left:840px;top:150px">${sprite('excited', 11)}</div>
    ${bubble('YOU CAME BACK.', 1000, 70, 26)}
    ${win('', sprite('sleeping', 2), 770, 420, 110, 84, '#d4f7ff')}
    ${win('', sprite('angry', 2), 1250, 380, 110, 84, '#ffd6ec')}`,
  ),
});

// Store small tile 440×280
jobs.push({
  name: 'tile',
  out: 'promo/store/small-tile-440x280.png',
  w: 440,
  h: 280,
  html: page(
    440,
    280,
    `<div class="sky"></div>
    <div style="position:absolute;left:24px;top:46px">${sprite('neutral', 5, { lookX: 1 })}</div>
    <div style="position:absolute;left:220px;top:70px">
      <div class="title" style="font-size:44px;text-shadow:4px 4px 0 #7a52e0">INTERNET<br><span>GREMLIN</span></div>
      <div class="tag" style="font-size:15px;margin-top:12px;text-shadow:2px 2px 0 #1c1230">Your browser.<br>Its territory. Your problem.</div>
    </div>`,
  ),
});

// Expressions sheet
{
  const cells = CORE_EXPRESSIONS.map(
    (e, i) =>
      `<div style="display:grid;justify-items:center;gap:8px;padding:16px 8px 12px;background:${['#ffd6ec', '#d4f7ff', '#fff6b8', '#dfffc4', '#e6d9ff'][i % 5]};box-shadow:0 0 0 3px #1c1230;color:#1c1230">${sprite(e, 4)}<div style="font-size:18px;font-weight:700">${i + 1}. ${EXPRESSION_LABELS[e]}</div></div>`,
  ).join('');
  jobs.push({
    name: 'expressions',
    out: 'assets/expressions-sheet.png',
    w: 1280,
    h: 900,
    html: page(
      1280,
      900,
      `<div class="sky"></div>
      <div style="position:absolute;inset:40px 50px">
        <div class="title" style="font-size:44px;text-shadow:4px 4px 0 #7a52e0">THE GREMLIN-DEX <span style="font-size:24px">· 15 expressions</span></div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:20px;margin-top:28px">${cells}</div>
      </div>`,
    ),
  });
}

// Stickers
const STICKERS: [string, Expression, string, Arms?][] = [
  ['you-came-back', 'excited', 'YOU CAME BACK.'],
  ['not-paid-enough', 'bored', 'I am not paid enough for this.'],
  ['clicked-again', 'suspicious', 'Again? You clicked again?'],
  ['seen-things', 'shocked', 'I have seen things in these tabs.'],
  ['my-human', 'love', 'Finally. My human.'],
  ['hehehe', 'evil', 'Hehehe.', 'hold'],
  ['nobody-understands', 'crying', 'Nobody understands gremlins.'],
  ['i-live-here', 'proud', 'I live here now.'],
];
for (const [slug, e, text, arms] of STICKERS) {
  const svg = sprite(e, 9, { arms });
  const copies = Array.from({ length: 12 }, (_, i) => {
    const ang = (i / 12) * Math.PI * 2;
    return `<div style="position:absolute;inset:0;transform:translate(${Math.round(Math.cos(ang) * 9)}px,${Math.round(Math.sin(ang) * 9)}px);filter:brightness(0) invert(1)">${svg}</div>`;
  }).join('');
  const shadow = `<div style="position:absolute;inset:0;transform:translate(8px,12px);filter:brightness(0);opacity:.3">${svg}</div>`;
  jobs.push({
    name: `sticker-${slug}`,
    out: `assets/stickers/${slug}.png`,
    w: 512,
    h: 512,
    transparent: true,
    html: page(
      512,
      512,
      `<div style="position:absolute;inset:0;display:grid;justify-items:center;align-content:center;gap:18px">
        <div style="position:relative">${shadow}${copies}<div style="position:relative">${svg}</div></div>
        <div style="max-width:440px;text-align:center;padding:10px 18px;background:#1c1230;color:#fff;font-size:30px;font-weight:700;box-shadow:0 0 0 5px #fff,0 0 0 9px #1c1230;transform:rotate(-3deg)">${text}</div>
      </div>`,
      'body{background:transparent}',
    ),
  });
}

// Framed store screenshots from real captures
const SHOTS: [string, string, string][] = [
  ['in-page-greeting', 'It lives on every page — and has opinions.', 'screenshot-1-greeting'],
  ['in-page-menu', 'Pet it, feed it, play with it. Or minimize it.', 'screenshot-2-menu'],
  ['popup', 'Moods, relationship, and its current thoughts.', 'screenshot-3-popup'],
  ['options', 'Settings, secrets, and the Gremlin-dex.', 'screenshot-4-settings'],
  ['onboarding-personality', 'Hatch it, name it, pick its personality.', 'screenshot-5-onboarding'],
];
for (const [file, caption, out] of SHOTS) {
  const src = join(root, 'assets/screenshots', `${file}.png`);
  if (!existsSync(src)) continue;
  const isPopup = file === 'popup';
  const isTall = file === 'options';
  jobs.push({
    name: out,
    out: `promo/store/${out}.png`,
    w: 1280,
    h: 800,
    html: page(
      1280,
      800,
      `<div class="sky"></div>
      <div style="position:absolute;left:60px;top:40px;display:flex;align-items:center;gap:16px">
        ${sprite('neutral', 2)}
        <div class="title" style="font-size:40px;text-shadow:4px 4px 0 #7a52e0">${caption}</div>
      </div>
      <div style="position:absolute;left:0;right:0;top:130px;bottom:30px;display:grid;place-items:center">
        <div style="box-shadow:0 0 0 4px #1c1230, 10px 12px 0 rgba(0,0,0,.4);overflow:hidden;${isPopup ? 'width:360px;height:610px' : isTall ? 'width:1020px;height:620px' : 'width:1040px;height:650px'}">
          <img src="/assets/screenshots/${file}.png" style="display:block;width:100%;${isTall ? 'object-fit:cover;object-position:top' : ''}">
        </div>
      </div>`,
    ),
  });
}

// ------------------------------------------------------------------ render
async function main() {
  if (!chromePath) throw new Error('Chrome not found; set CHROME_PATH');
  const server = createServer((req, res) => {
    const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = join(root, p);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const addr = server.address();
  const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  try {
    for (const job of jobs) {
      const htmlPath = join(work, `${job.name}.html`);
      writeFileSync(htmlPath, job.html);
      const page = await browser.newPage({ viewport: { width: job.w, height: job.h } });
      await page.goto(`${base}/.scratch/promo/${job.name}.html`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(root, job.out), omitBackground: job.transparent ?? false });
      await page.close();
      console.log(`  ✓ ${job.out}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
