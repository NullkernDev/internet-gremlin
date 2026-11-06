/**
 * Generates the pixel-art assets straight from the sprite renderer, so every
 * icon and sheet is on-model:
 *   public/icons/icon-{16,32,48,128}.png   extension icons
 *   public/img/sky.png                     pixel-cloud sky used by the pages
 *   assets/expressions/*.{svg,png}          all expressions, transparent
 *   assets/mascot.{svg,png}                 main mascot artwork
 *
 * Run with: npm run assets
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE } from '../src/sprite/palette';
import { buildFrame, EXPRESSIONS, renderSprite, SPRITE_H, SPRITE_W, type FrameOptions } from '../src/sprite/sprite';
import { hexToRgb, Image } from './png';

const root = resolve(import.meta.dirname, '..');
const out = (p: string) => {
  const full = resolve(root, p);
  mkdirSync(resolve(full, '..'), { recursive: true });
  return full;
};

/** Rasterise a sprite frame with integer nearest-neighbour scaling. */
function spriteImage(opts: FrameOptions, scale: number, canvas?: { w: number; h: number; crop?: [number, number, number, number] }): Image {
  const g = buildFrame(opts);
  const [cx, cy, cw, ch] = canvas?.crop ?? [0, 0, SPRITE_W, SPRITE_H];
  const w = canvas?.w ?? cw * scale;
  const h = canvas?.h ?? ch * scale;
  const img = new Image(w, h);
  const ox = Math.floor((w - cw * scale) / 2);
  const oy = Math.floor((h - ch * scale) / 2);
  for (const [k, c] of g.px) {
    const x = (k % SPRITE_W) - cx;
    const y = Math.floor(k / SPRITE_W) - cy;
    if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
    const [r, gg, b] = hexToRgb(c);
    for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) img.set(ox + x * scale + xx, oy + y * scale + yy, r, gg, b);
  }
  return img;
}

// ---------------------------------------------------------------- icons
// 16px: a hand-placed tiny version (the full sprite can't survive at 16px).
const ICON16 = [
  '.K..........KK..',
  'KPK........KBBK.',
  'KPPK......KBBBK.',
  'KBPBKKKKKKBBBK..',
  'KBBBBBBBBBBBBBK.',
  'KBKKKBBBBKKKBBK.',
  'KBKWGKBBBKWGKBK.',
  'KBKWDKBBBKWDKBK.',
  'KBKKKKBBBKKKKBK.',
  'KBBBBBBBBBBBBBKK',
  'KBBBKBBBBBKBBBKG',
  'KSBBBKKKKKBBBSKG',
  '.KSSBBBBBBBBSKK.',
  '..KKSKKKKKKSKK..',
  '...KK......KK...',
  '................',
];
{
  const map: Record<string, string> = {
    K: PALETTE.outline,
    B: PALETTE.body,
    S: PALETTE.bodyShade,
    P: PALETTE.earInner,
    W: PALETTE.white,
    G: PALETTE.iris,
    D: PALETTE.pupil,
  };
  const img = new Image(16, 16);
  ICON16.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = map[ch];
      if (c) {
        const [r, g, b] = hexToRgb(c);
        img.set(x, y, r, g, b);
      }
    }),
  );
  writeFileSync(out('public/icons/icon-16.png'), img.encode());
}
writeFileSync(out('public/icons/icon-32.png'), spriteImage({ expression: 'neutral' }, 1, { w: 32, h: 32, crop: [3, 0, 30, 26] }).encode());
writeFileSync(out('public/icons/icon-48.png'), spriteImage({ expression: 'neutral' }, 1, { w: 48, h: 48 }).encode());
writeFileSync(out('public/icons/icon-128.png'), spriteImage({ expression: 'neutral' }, 3, { w: 128, h: 128 }).encode());

// ---------------------------------------------------------------- sky
// Fractal value-noise clouds, quantised with ordered dithering into a small
// teal/blue palette, plus faint scanlines — a nod to old desktop wallpapers.
{
  const W = 320;
  const H = 180;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const G = 32;
  const lattice = Array.from({ length: (G + 1) * (G + 1) }, rand);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * (t * t * (3 - 2 * t));
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x) % G;
    const yi = Math.floor(y) % G;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const v = (i: number, j: number) => lattice[((yi + j) % G) * (G + 1) + ((xi + i) % G)];
    return lerp(lerp(v(0, 0), v(1, 0), xf), lerp(v(0, 1), v(1, 1), xf), yf);
  };
  const fbm = (x: number, y: number) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    for (let o = 0; o < 5; o++) {
      s += a * noise(x * f, y * f);
      a *= 0.5;
      f *= 2;
    }
    return s;
  };
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
  const ramp = ['#071433', '#0b2049', '#10325f', '#144a72', '#196580', '#22818b', '#3c9f9c', '#74c6b8'];
  const img = new Image(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = y / H;
      const cloud = fbm(x / 70 + 3, y / 26 + 1);
      const v = cloud * 0.75 + (1 - t) * 0.55 - 0.32 + bayer[(y % 4) * 4 + (x % 4)] * 0.1;
      let i = Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)));
      if (y % 3 === 2 && i > 0) i -= 1; // faint scanlines
      const [r, g, b] = hexToRgb(ramp[i]);
      img.set(x, y, r, g, b);
    }
  }
  writeFileSync(out('public/img/sky.png'), img.encode());
}

// ---------------------------------------------------------------- expressions
for (const e of EXPRESSIONS) {
  writeFileSync(out(`assets/expressions/${e}.svg`), renderSprite({ expression: e }, 8));
  writeFileSync(out(`assets/expressions/${e}.png`), spriteImage({ expression: e }, 8).encode());
}
writeFileSync(out('assets/mascot.svg'), renderSprite({ expression: 'neutral', lookX: 1 }, 16));
writeFileSync(out('assets/mascot.png'), spriteImage({ expression: 'neutral', lookX: 1 }, 16).encode());
writeFileSync(out('assets/mascot-golden.png'), spriteImage({ expression: 'neutral', golden: true }, 16).encode());

console.log(`✔ assets generated (${EXPRESSIONS.length} expressions, 4 icons, sky)`);
