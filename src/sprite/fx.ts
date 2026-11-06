/**
 * Small pixel-art stamps: effects (hearts, Zzz, ?, !) and snacks.
 * Same outline colour and palette as the Gremlin for a consistent look.
 */
import { PALETTE } from './palette';

type Stamp = { rows: string[]; map: Record<string, string> };

const K = PALETTE.outline;

export const STAMPS = {
  heart: {
    rows: ['.KK.KK.', 'KhHKHHK', 'KHHHHHK', '.KHHHK.', '..KHK..', '...K...'],
    map: { K, H: PALETTE.heart, h: PALETTE.heartHi },
  },
  z: { rows: ['KKKKK', 'KWWWK', 'KKWKK', '.KWK.', 'KWKKK', 'KWWWK', 'KKKKK'], map: { K, W: PALETTE.white } },
  question: {
    rows: ['.KKKK.', 'KWWWWK', 'KWKKWK', 'KKKWWK', '..KWK.', '..KKK.', '..KWK.', '..KKK.'],
    map: { K, W: PALETTE.white },
  },
  exclaim: { rows: ['KKK', 'KYK', 'KYK', 'KYK', 'KYK', 'KKK', 'KYK', 'KKK'], map: { K, Y: PALETTE.star } },
  sparkle: { rows: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'], map: { Y: PALETTE.star, W: PALETTE.white } },
  anger: { rows: ['RR.RR', 'R...R', '.....', 'R...R', 'RR.RR'], map: { R: PALETTE.vein } },
  note: { rows: ['..KKK', '..KWK', '..KKK', '..K..', 'KKK..', 'KWK..', 'KKK..'], map: { K, W: PALETTE.iris } },
  drop: { rows: ['.K.', 'KCK', 'CLC', 'KCK', '.K.'], map: { K, C: PALETTE.tear, L: PALETTE.tearLight } },
  tear: { rows: ['C.', 'CL'], map: { C: PALETTE.tear, L: PALETTE.tearLight } },
  crumb: { rows: ['BB', 'Bb'], map: { B: '#c98a4b', b: '#8a5528' } },
  cookie: {
    rows: ['..KKKK..', '.KBBBBK.', 'KBbBBdBK', 'KBBBBBBK', 'KBdBBbBK', 'KBBBdBBK', '.KBBBBK.', '..KKKK..'],
    map: { K, B: '#e0a764', b: '#7a4520', d: '#a2622e' },
  },
  byte: {
    rows: ['KKKKKKKK', 'KGGGGGGK', 'KGKGGKGK', 'KGGGGGGK', 'KGKKGKGK', 'KGGGGGGK', 'KKKKKKKK'],
    map: { K, G: PALETTE.iris },
  },
  bug: {
    rows: ['K.....K', '.K...K.', '..KKK..', 'KKRRRKK', '.KRKRK.', 'KKRRRKK', '..KKK..'],
    map: { K, R: '#ff6b5e' },
  },
  egg: {
    rows: [
      '...KKKK...',
      '..KWWWWK..',
      '.KWWWPWWK.',
      '.KWWWWWWK.',
      'KWPWWWWWWK',
      'KWWWWWPWWK',
      'KWWWWWWWWK',
      'KSWWWWWWSK',
      '.KSSWWSSK.',
      '..KKKKKK..',
    ],
    map: { K, W: PALETTE.belly, P: PALETTE.body, S: PALETTE.bodyHi },
  },
} satisfies Record<string, Stamp>;

export type StampName = keyof typeof STAMPS;

export function stampSvg(name: StampName, scale = 1): string {
  const { rows, map } = STAMPS[name] as Stamp;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  let d = '';
  const byColor = new Map<string, string>();
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = map[ch];
      if (!c) return;
      byColor.set(c, (byColor.get(c) ?? '') + `M${x} ${y}h1v1h-1z`);
    });
  });
  for (const [c, path] of byColor) d += `<path fill="${c}" d="${path}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${d}</svg>`;
}
