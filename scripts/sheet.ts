import { writeFileSync } from 'node:fs';
import { EXPRESSIONS, renderSprite, SPRITE_W, SPRITE_H } from '../src/sprite/sprite';
const s = 8, cols = 5;
let out = '';
EXPRESSIONS.forEach((e, i) => {
  const x = (i % cols) * (SPRITE_W * s + 20), y = Math.floor(i / cols) * (SPRITE_H * s + 40);
  const svg = renderSprite({ expression: e }).replace('<svg ', `<svg x="${x}" y="${y}" `).replace(/width="\d+" height="\d+"/, `width="${SPRITE_W*s}" height="${SPRITE_H*s}"`);
  out += svg + `<text x="${x + 100}" y="${y + SPRITE_H*s + 25}" font-size="22" font-family="sans-serif">${e}</text>`;
});
const W = cols * (SPRITE_W * s + 20), H = Math.ceil(EXPRESSIONS.length / cols) * (SPRITE_H * s + 40);
writeFileSync(process.argv[2], `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#2a8c8c"/>${out}</svg>`);
