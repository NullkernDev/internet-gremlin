/**
 * Procedural pixel-art renderer for the Gremlin.
 *
 * The creature is described with simple shapes (an egg-shaped body, a tall
 * notched ear, a floppy ear, stubby limbs and an ethernet-cable tail). The
 * renderer rasterises those shapes onto a 36×32 grid, auto-outlines the
 * silhouette, shades it, and stamps a face on top. Because everything is
 * generated from the same code, every asset stays perfectly on-model.
 */
import { PALETTE } from './palette';

export const SPRITE_W = 36;
export const SPRITE_H = 32;

export const EXPRESSIONS = [
  'neutral',
  'happy',
  'angry',
  'bored',
  'sleepy',
  'shocked',
  'suspicious',
  'sad',
  'excited',
  'evil',
  'crying',
  'proud',
  'confused',
  'love',
  'exhausted',
  'innocent',
  'dizzy',
  'stare',
  'sleeping',
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/** The fifteen expressions required by the design brief, in brief order. */
export const CORE_EXPRESSIONS: Expression[] = [
  'happy',
  'angry',
  'bored',
  'sleepy',
  'shocked',
  'suspicious',
  'sad',
  'excited',
  'evil',
  'crying',
  'proud',
  'confused',
  'love',
  'exhausted',
  'innocent',
];

export const EXPRESSION_LABELS: Record<Expression, string> = {
  neutral: 'Neutral',
  happy: 'Happy',
  angry: 'Angry',
  bored: 'Bored',
  sleepy: 'Sleepy',
  shocked: 'Shocked',
  suspicious: 'Suspicious',
  sad: 'Sad',
  excited: 'Excited',
  evil: 'Evil grin',
  crying: 'Crying dramatically',
  proud: 'Proud',
  confused: 'Confused',
  love: 'In love',
  exhausted: 'Exhausted',
  innocent: 'Fake innocent',
  dizzy: 'Dizzy',
  stare: 'The Stare',
  sleeping: 'Asleep',
};

export type Arms = 'down' | 'up' | 'crossed' | 'wave' | 'hold' | 'flail';
export type Legs = 'stand' | 'stepL' | 'stepR' | 'tuck';
export type Look = -1 | 0 | 1;

export interface FrameOptions {
  expression: Expression;
  lookX?: Look;
  lookY?: Look;
  blink?: boolean;
  arms?: Arms;
  legs?: Legs;
  /** -1 = stretched (jumping), 0 = normal, 1 = squashed (landing / slumped) */
  squash?: -1 | 0 | 1;
  golden?: boolean;
  /** Animation frame counter for tears, tail swish and flailing. */
  frame?: number;
}

type EyeType =
  | 'open'
  | 'happy'
  | 'closed'
  | 'blink'
  | 'half'
  | 'heavy'
  | 'wide'
  | 'star'
  | 'heart'
  | 'x'
  | 'spiral'
  | 'squintL'
  | 'squintR'
  | 'sparkle'
  | 'stare'
  | 'angryL'
  | 'angryR'
  | 'sadL'
  | 'sadR'
  | 'narrow'
  | 'evilL'
  | 'evilR';

type MouthType =
  | 'smile'
  | 'grin'
  | 'frown'
  | 'flat'
  | 'o'
  | 'O'
  | 'wail'
  | 'evil'
  | 'wavy'
  | 'cat'
  | 'smirk'
  | 'tongue'
  | 'snarl';

type Extra = 'blush' | 'tear' | 'stream' | 'sweat' | 'vein' | 'bags' | 'brow';

interface ExpressionDef {
  L: EyeType;
  R: EyeType;
  mouth: MouthType;
  extras?: Extra[];
  tint?: 'angry' | 'pale';
  arms?: Arms;
  squash?: -1 | 0 | 1;
  look?: [Look, Look];
  tooth?: boolean;
}

const DEFS: Record<Expression, ExpressionDef> = {
  neutral: { L: 'open', R: 'open', mouth: 'smile', tooth: true },
  happy: { L: 'happy', R: 'happy', mouth: 'grin', extras: ['blush'] },
  angry: { L: 'angryL', R: 'angryR', mouth: 'snarl', extras: ['vein'], tint: 'angry', arms: 'crossed' },
  bored: { L: 'half', R: 'half', mouth: 'flat', look: [1, 0], tooth: true },
  sleepy: { L: 'heavy', R: 'heavy', mouth: 'O', extras: ['bags'] },
  shocked: { L: 'wide', R: 'wide', mouth: 'O', extras: ['sweat'], tint: 'pale', arms: 'up', squash: -1 },
  suspicious: { L: 'narrow', R: 'half', mouth: 'wavy', look: [-1, 0], extras: ['brow'] },
  sad: { L: 'sadL', R: 'sadR', mouth: 'frown', look: [0, 1], extras: ['tear'] },
  excited: { L: 'star', R: 'star', mouth: 'grin', extras: ['blush'], arms: 'up' },
  evil: { L: 'evilL', R: 'evilR', mouth: 'evil', arms: 'hold' },
  crying: { L: 'squintL', R: 'squintR', mouth: 'wail', extras: ['stream'], arms: 'flail' },
  proud: { L: 'closed', R: 'closed', mouth: 'smirk', extras: ['blush'], arms: 'crossed', squash: -1 },
  confused: { L: 'open', R: 'half', mouth: 'wavy', look: [1, -1], extras: ['brow', 'sweat'] },
  love: { L: 'heart', R: 'heart', mouth: 'cat', extras: ['blush'], arms: 'wave' },
  exhausted: { L: 'x', R: 'x', mouth: 'tongue', extras: ['sweat', 'bags'], tint: 'pale', squash: 1 },
  innocent: { L: 'sparkle', R: 'sparkle', mouth: 'cat', extras: ['blush'], look: [0, -1], arms: 'hold' },
  dizzy: { L: 'spiral', R: 'spiral', mouth: 'wavy', extras: ['sweat'], arms: 'flail' },
  stare: { L: 'stare', R: 'stare', mouth: 'flat' },
  sleeping: { L: 'closed', R: 'closed', mouth: 'o', squash: 1, arms: 'down' },
};

/** Default arm pose for an expression, used by the renderer and the UI. */
export function defaultArms(expr: Expression): Arms {
  return DEFS[expr].arms ?? 'down';
}

class Grid {
  readonly px = new Map<number, string>();
  set(x: number, y: number, c: string): void {
    if (x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H) return;
    this.px.set(y * SPRITE_W + x, c);
  }
  get(x: number, y: number): string | undefined {
    return this.px.get(y * SPRITE_W + x);
  }
  has(x: number, y: number): boolean {
    return this.px.has(y * SPRITE_W + x);
  }
  del(x: number, y: number): void {
    this.px.delete(y * SPRITE_W + x);
  }
}

type Pt = [number, number];

function inPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

interface BodyGeom {
  cx: number;
  cy: number;
  rx: number;
  ryTop: number;
  ryBot: number;
}

function bodyGeom(squash: number): BodyGeom {
  const ryBot = 8.6 * (1 - 0.07 * squash);
  const ryTop = 9.6 * (1 - 0.11 * squash);
  return { cx: 16, cy: 26.2 - ryBot, rx: 11.2 * (1 + 0.07 * squash), ryTop, ryBot };
}

/** Normalised "egg distance" (≤1 means inside the body). */
function eggValue(x: number, y: number, g: BodyGeom): { v: number; dx: number; dy: number; rx: number; ry: number } {
  const dy = y - g.cy;
  const ry = dy < 0 ? g.ryTop : g.ryBot;
  const rx = g.rx * (1 + 0.1 * Math.max(-1, Math.min(1, dy / g.ryBot)));
  const nx = (x - g.cx) / rx;
  const ny = dy / ry;
  return { v: nx * nx + ny * ny, dx: nx, dy: ny, rx, ry };
}

const tailPaths: Pt[][] = [
  [
    [26, 24],
    [27, 25],
    [28, 26],
    [29, 26],
    [30, 26],
    [31, 25],
    [32, 24],
    [32, 23],
  ],
  [
    [26, 24],
    [27, 25],
    [28, 25],
    [29, 26],
    [30, 26],
    [31, 26],
    [32, 25],
    [33, 24],
  ],
];

/** Build the pixel grid for one frame of the Gremlin. */
export function buildFrame(opts: FrameOptions): Grid {
  const def = DEFS[opts.expression];
  const squash = opts.squash ?? def.squash ?? 0;
  const arms = opts.arms ?? def.arms ?? 'down';
  const legs = opts.legs ?? (opts.expression === 'sleeping' ? 'tuck' : 'stand');
  const frame = opts.frame ?? 0;
  const geom = bodyGeom(squash);
  const topY = geom.cy - geom.ryTop;
  const earDy = Math.round(topY - 8);
  const faceDy = squash === 1 ? 1 : squash === -1 ? -1 : 0;

  let bodyCol: string = PALETTE.body;
  let shadeCol: string = PALETTE.bodyShade;
  if (def.tint === 'angry') {
    bodyCol = PALETTE.angryBody;
    shadeCol = PALETTE.angryShade;
  } else if (def.tint === 'pale') {
    bodyCol = PALETTE.paleBody;
    shadeCol = PALETTE.paleShade;
  }

  // ---- silhouette masks -------------------------------------------------
  const kind = new Map<number, 'body' | 'earL' | 'earR' | 'arm' | 'foot' | 'cable' | 'plug' | 'prong'>();
  const key = (x: number, y: number) => y * SPRITE_W + x;
  const earL: Pt[] = [
    [6.0, 11 + earDy],
    [7.4, 1.0 + earDy],
    [9.4, 0.6 + earDy],
    [12.9, 9.6 + earDy],
  ];
  const earR: Pt[] = [
    [19.4, 9.6 + earDy],
    [22.4, 4.4 + earDy],
    [25.6, 3.9 + earDy],
    [29.4, 6.0 + earDy],
    [31.2, 9.4 + earDy],
    [28.4, 9.2 + earDy],
    [25.4, 8.4 + earDy],
    [23.6, 10.6 + earDy],
  ];
  const armShapes: Array<[number, number, number, number]> = [];
  const flailUp = frame % 2 === 0;
  const armDown = (side: -1 | 1): [number, number, number, number] => [16 + side * 11.4, 21, 1.7, 2.4];
  const armUp = (side: -1 | 1): [number, number, number, number] => [16 + side * 11.8, 14.6, 1.5, 3.0];
  if (arms === 'down') armShapes.push(armDown(-1), armDown(1));
  if (arms === 'up') armShapes.push(armUp(-1), armUp(1));
  if (arms === 'wave') armShapes.push(armDown(-1), armUp(1));
  if (arms === 'flail') armShapes.push(flailUp ? armUp(-1) : armDown(-1), flailUp ? armDown(1) : armUp(1));

  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (eggValue(px, py, geom).v <= 1) kind.set(key(x, y), 'body');
      else if (inPoly(px, py, earL) && !inEllipse(px, py, 10.9, 4.4 + earDy, 1.05, 1.05)) kind.set(key(x, y), 'earL');
      else if (inPoly(px, py, earR)) kind.set(key(x, y), 'earR');
      else if (armShapes.some(([cx, cy, rx, ry]) => inEllipse(px, py, cx, cy, rx, ry))) kind.set(key(x, y), 'arm');
      else if (legs !== 'tuck') {
        const ly = legs === 'stepL' ? 25.6 : 26.6;
        const ry = legs === 'stepR' ? 25.6 : 26.6;
        if (inEllipse(px, py, 11.6, ly, 2.4, 1.5) || inEllipse(px, py, 20.4, ry, 2.4, 1.5)) kind.set(key(x, y), 'foot');
      }
    }
  }
  const tail = tailPaths[Math.floor(frame / 4) % 2];
  for (const [x, y] of tail) if (!kind.has(key(x, y))) kind.set(key(x, y), 'cable');
  const [tx, ty] = tail[tail.length - 1];
  for (let y = ty - 3; y <= ty - 1; y++) for (let x = tx - 1; x <= tx + 1; x++) kind.set(key(x, y), 'plug');
  kind.set(key(tx - 1, ty - 4), 'prong');
  kind.set(key(tx + 1, ty - 4), 'prong');

  const g = new Grid();
  // outline: any empty pixel orthogonally touching the silhouette
  for (const k of kind.keys()) {
    const x = k % SPRITE_W;
    const y = Math.floor(k / SPRITE_W);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SPRITE_W || ny >= SPRITE_H) continue;
      if (!kind.has(key(nx, ny))) g.set(nx, ny, PALETTE.outline);
    }
  }

  // ---- fill & shade -----------------------------------------------------
  const bellyCy = 22.4 + faceDy * 0.5;
  for (const [k, kd] of kind) {
    const x = k % SPRITE_W;
    const y = Math.floor(k / SPRITE_W);
    const px = x + 0.5;
    const py = y + 0.5;
    let c: string = bodyCol;
    if (kd === 'body') {
      const e = eggValue(px, py, geom);
      const light = -e.dx * 0.55 - e.dy * 0.85;
      if (e.v > 0.6 && light < -0.25) c = shadeCol;
      else if (e.v > 0.42 && e.v < 0.78 && light > 0.62) c = PALETTE.bodyHi;
      else if (inEllipse(px, py, 16, bellyCy, 6.4, 3.3)) c = PALETTE.belly;
    } else if (kd === 'earL') {
      const inner: Pt[] = [
        [8.2, 9.8 + earDy],
        [8.6, 3.0 + earDy],
        [11.2, 9.2 + earDy],
      ];
      if (inPoly(px, py, inner)) c = PALETTE.earInner;
      else if (px > 11.2) c = shadeCol;
    } else if (kd === 'earR') {
      const inner: Pt[] = [
        [22.4, 8.6 + earDy],
        [24.6, 5.4 + earDy],
        [27.6, 6.8 + earDy],
        [25.0, 7.6 + earDy],
      ];
      if (inPoly(px, py, inner)) c = PALETTE.earInner;
      else if (py > 8.4 + earDy || px > 29.5) c = shadeCol;
    } else if (kd === 'arm') {
      c = !kind.has(key(x, y + 1)) || kind.get(key(x, y + 1)) !== 'arm' ? shadeCol : bodyCol;
    } else if (kd === 'foot') {
      c = shadeCol;
    } else if (kd === 'cable') {
      c = PALETTE.cable;
    } else if (kd === 'plug') {
      c = y === ty - 3 ? PALETTE.plugMetal : PALETTE.plug;
    } else if (kd === 'prong') {
      c = PALETTE.plugMetal;
    }
    g.set(x, y, c);
  }
  // the cable's highlight
  for (const [x, y] of tail.slice(1, -1)) if (y % 2 === 0) g.set(x, y, PALETTE.cableHi);

  // separation lines where limbs meet the body (gives them volume)
  if (arms === 'crossed') drawCrossedArms(g, bodyCol, shadeCol, faceDy);
  if (arms === 'hold') drawHoldArms(g, bodyCol, shadeCol);

  // ---- face ---------------------------------------------------------------
  const lookX = opts.lookX ?? def.look?.[0] ?? 0;
  const lookY = opts.lookY ?? def.look?.[1] ?? 0;
  const ey = 11 + faceDy;
  const irisCol = opts.golden ? PALETTE.gold : PALETTE.iris;
  const irisShade = opts.golden ? PALETTE.goldHi : PALETTE.irisShade;
  const eyeCtx: EyeCtx = { g, skin: bodyCol, iris: irisCol, irisShade, lookX, lookY, frame };
  const lType = opts.blink && blinkable(def.L) ? 'blink' : def.L;
  const rType = opts.blink && blinkable(def.R) ? 'blink' : def.R;
  drawEye(eyeCtx, 8, ey, lType, 'L');
  drawEye(eyeCtx, 18, ey, rType, 'R');
  drawMouth(g, def.mouth, 20 + faceDy, def.tooth ?? false);
  for (const ex of def.extras ?? []) drawExtra(g, ex, faceDy, frame, bodyCol);
  return g;
}

function blinkable(t: EyeType): boolean {
  return ['open', 'half', 'wide', 'sparkle', 'narrow', 'sadL', 'sadR'].includes(t);
}

function drawCrossedArms(g: Grid, body: string, shade: string, faceDy: number): void {
  // folded arms: two forearms meeting in a V in front of the belly
  const y0 = 22 + Math.max(0, faceDy);
  pattern(g, 9, y0, ['.KKKK.....KKKK.', 'KBBBBKK.KKBBBBK', '.KKBBBBKBBBBKK.', '...KSSSSSSSK...', '....KKKKKKK....'], {
    K,
    B: body,
    S: shade,
  });
}

function drawHoldArms(g: Grid, body: string, shade: string): void {
  // two little paws clasped in front of the belly
  pattern(g, 12, 23, ['.KK.KK.', 'KBBKBBK', 'KSSKSSK', '.KK.KK.'].map((r) => '.' + r), { K, B: body, S: shade });
}

interface EyeCtx {
  g: Grid;
  skin: string;
  iris: string;
  irisShade: string;
  lookX: number;
  lookY: number;
  frame: number;
}

const K = PALETTE.outline;
const W = PALETTE.white;

function openSclera(g: Grid, x0: number, y0: number): void {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const corner = (r === 0 || r === 6) && (c === 0 || c === 6);
      if (corner) continue;
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      g.set(x0 + c, y0 + r, edge ? K : W);
    }
  }
}

function iris(ctx: EyeCtx, x0: number, y0: number, lx: number, ly: number): void {
  const ix = x0 + 2 + lx;
  const iy = y0 + (ly < 0 ? 1 : 2);
  const { g } = ctx;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      let col = ctx.iris;
      if (r === 3) col = ctx.irisShade;
      if (c === 1 && (r === 1 || r === 2)) col = PALETTE.pupil;
      if (r === 0 && c === 0) col = W;
      g.set(ix + c, iy + r, col);
    }
  }
}

/** Cover the top of an eye with skin; `tops[c]` is the first visible row. */
function lidTop(ctx: EyeCtx, x0: number, y0: number, tops: number[], brow = false): void {
  for (let c = 0; c < 7; c++) {
    const t = tops[c];
    for (let r = 0; r < t; r++) ctx.g.set(x0 + c, y0 + r, ctx.skin);
    if (t > 0) ctx.g.set(x0 + c, y0 + t, K);
    if (brow && t > 0) ctx.g.set(x0 + c, y0 + t - 1, K);
  }
}

function lidBottom(ctx: EyeCtx, x0: number, y0: number, bottom: number): void {
  for (let c = 0; c < 7; c++) {
    ctx.g.set(x0 + c, y0 + bottom, K);
    for (let r = bottom + 1; r < 7; r++) ctx.g.set(x0 + c, y0 + r, ctx.skin);
  }
}

function pattern(g: Grid, x0: number, y0: number, rows: string[], map: Record<string, string>): void {
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const col = map[ch];
      if (col) g.set(x0 + c, y0 + r, col);
    });
  });
}

function drawEye(ctx: EyeCtx, x0: number, y0: number, type: EyeType, side: 'L' | 'R'): void {
  const { g } = ctx;
  const lx = ctx.lookX;
  const ly = ctx.lookY;
  switch (type) {
    case 'open':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, lx, ly);
      break;
    case 'blink':
      pattern(g, x0, y0 + 3, ['.......', 'KKKKKKK', '.K...K.'], { K });
      break;
    case 'happy':
      pattern(g, x0, y0 + 2, ['..KKK..', '.KK.KK.', 'KK...KK'], { K });
      break;
    case 'closed':
      pattern(g, x0, y0 + 3, ['K.....K', 'KK...KK', '.KKKKK.'], { K });
      break;
    case 'half':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, lx, 0);
      lidTop(ctx, x0, y0, [2, 2, 2, 2, 2, 2, 2]);
      break;
    case 'heavy':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, lx, 1);
      lidTop(ctx, x0, y0, [3, 3, 3, 3, 3, 3, 3]);
      break;
    case 'narrow':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, lx, 0);
      lidTop(ctx, x0, y0, [2, 2, 2, 3, 3, 3, 3]);
      lidBottom(ctx, x0, y0, 5);
      break;
    case 'wide':
      openSclera(g, x0, y0);
      g.set(x0 + 3, y0 + 3, PALETTE.pupil);
      g.set(x0 + 3, y0 + 4, PALETTE.pupil);
      break;
    case 'stare':
      openSclera(g, x0, y0);
      pattern(g, x0 + 2, y0 + 2, ['III', 'IKI', 'III'], { I: ctx.iris, K: PALETTE.pupil });
      break;
    case 'star':
      openSclera(g, x0, y0);
      pattern(g, x0 + 1, y0 + 1, ['KKSKK', 'KSSSK', 'SSWSS', 'KSSSK', 'KKSKK'], {
        K: PALETTE.pupil,
        S: PALETTE.star,
        W,
      });
      break;
    case 'heart':
      pattern(g, x0, y0, ['.KK.KK.', 'KhHKHHK', 'KHHHHHK', 'KHHHHHK', '.KHHHK.', '..KHK..', '...K...'], {
        K,
        H: PALETTE.heart,
        h: PALETTE.heartHi,
      });
      break;
    case 'x':
      pattern(g, x0 + 1, y0 + 1, ['K...K', '.K.K.', '..K..', '.K.K.', 'K...K'], { K });
      break;
    case 'spiral': {
      openSclera(g, x0, y0);
      const rows = ctx.frame % 2 === 0 ? ['KKKKK', '....K', '.KK.K', '.K..K', '.KKKK'] : ['KKKK.', 'K....', 'K.KK.', 'K..K.', 'KKKK.'];
      pattern(g, x0 + 1, y0 + 1, side === 'L' ? rows : rows.map((r) => [...r].reverse().join('')), { K });
      break;
    }
    case 'squintL':
      pattern(g, x0 + 1, y0 + 1, ['KK...', '.KKK.', '...KK', '.KKK.', 'KK...'], { K });
      break;
    case 'squintR':
      pattern(g, x0 + 1, y0 + 1, ['...KK', '.KKK.', 'KK...', '.KKK.', '...KK'], { K });
      break;
    case 'sparkle':
      openSclera(g, x0, y0);
      pattern(g, x0 + 1, y0 + 1, ['WIIIW', 'IKKKI', 'IKKWI', 'IKKKI', 'SIIIS'], {
        I: ctx.iris,
        K: PALETTE.pupil,
        W,
        S: ctx.irisShade,
      });
      g.set(x0 + 2, y0 + 2, W);
      break;
    case 'angryL':
    case 'evilL':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, 1, 1);
      lidTop(ctx, x0, y0, [1, 1, 2, 2, 3, 3, 4], true);
      if (type === 'evilL') lidBottom(ctx, x0, y0, 5);
      break;
    case 'angryR':
    case 'evilR':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, -1, 1);
      lidTop(ctx, x0, y0, [4, 3, 3, 2, 2, 1, 1], true);
      if (type === 'evilR') lidBottom(ctx, x0, y0, 5);
      break;
    case 'sadL':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, 0, 1);
      lidTop(ctx, x0, y0, [3, 3, 2, 2, 1, 1, 1]);
      break;
    case 'sadR':
      openSclera(g, x0, y0);
      iris(ctx, x0, y0, 0, 1);
      lidTop(ctx, x0, y0, [1, 1, 1, 2, 2, 3, 3]);
      break;
  }
}

function drawMouth(g: Grid, type: MouthType, y: number, tooth: boolean): void {
  const M = PALETTE.mouth;
  const T = PALETTE.tongue;
  const map = { K, M, T, W: PALETTE.tooth };
  switch (type) {
    case 'smile':
      pattern(g, 13, y - 1, ['K.....K', '.KKKKK.'], map);
      break;
    case 'grin':
      pattern(g, 13, y - 1, ['KKKKKKK', 'KWMMMMK', '.KTTTK.', '..KKK..'], map);
      break;
    case 'frown':
      pattern(g, 13, y - 1, ['.KKKKK.', 'K.....K'], map);
      break;
    case 'flat':
      pattern(g, 14, y, ['KKKKK'], map);
      break;
    case 'o':
      pattern(g, 15, y - 1, ['.KK.', 'KMMK', '.KK.'], map);
      break;
    case 'O':
      pattern(g, 14, y - 2, ['.KKK.', 'KMMMK', 'KMMMK', 'KMTMK', '.KKK.'], map);
      break;
    case 'wail':
      pattern(g, 12, y - 2, ['KKKKKKKKK', 'KWMMMMMWK', 'KMMMMMMMK', '.KMMTTMK.', '..KKKKK..'], map);
      break;
    case 'evil':
      pattern(g, 11, y - 1, ['KKKKKKKKKKK', 'KWMWMWMWMWK', '.KMWMWMWMK.', '..KKKKKKK..'], map);
      break;
    case 'snarl':
      pattern(g, 12, y - 1, ['..KKKKK..', '.KWMMMWK.', 'K.KKKKK.K'], map);
      break;
    case 'wavy':
      pattern(g, 12, y - 1, ['.K...K...', 'K.K.K.K.K', '...K...K.'], map);
      break;
    case 'cat':
      pattern(g, 13, y - 1, ['K..K..K', '.KK.KK.'], map);
      break;
    case 'smirk':
      pattern(g, 13, y - 1, ['......K', 'KKKKKK.'], map);
      break;
    case 'tongue':
      pattern(g, 13, y, ['KKKKKKK', '..KTTK.', '..KTTK.', '...KK..'], map);
      break;
  }
  if (tooth) {
    // Gorp's signature snaggletooth
    g.set(17, y + 1, PALETTE.tooth);
    g.set(17, y + 2, K);
    g.set(16, y + 1, K);
    g.set(18, y + 1, K);
  }
}

function drawExtra(g: Grid, ex: Extra, faceDy: number, frame: number, skin: string): void {
  const y = 18 + faceDy;
  switch (ex) {
    case 'blush':
      for (const x of [7, 8, 9, 22, 23, 24]) g.set(x, y, PALETTE.blush);
      break;
    case 'bags':
      for (const x of [9, 10, 11, 12, 19, 20, 21, 22]) g.set(x, y, PALETTE.bags);
      break;
    case 'tear':
      g.set(9, y, PALETTE.tear);
      g.set(9, y + 1, PALETTE.tear);
      g.set(9, y + 2, PALETTE.tearLight);
      break;
    case 'stream':
      for (let yy = y - 1; yy <= 26; yy++) {
        const light = (yy + frame) % 3 === 0;
        for (const x of [9, 10, 21, 22]) g.set(x, yy, light ? PALETTE.tearLight : PALETTE.tear);
      }
      break;
    case 'sweat':
      pattern(g, 27, 9 + faceDy, ['.K.', 'KCK', 'CLC', '.K.'], { K, C: PALETTE.tear, L: PALETTE.tearLight });
      break;
    case 'vein':
      pattern(g, 22, 8 + faceDy, ['V.V', '...', 'V.V'], { V: PALETTE.vein });
      g.set(23, 8 + faceDy, skin);
      break;
    case 'brow':
      for (let x = 19; x <= 24; x++) g.set(x, 9 + faceDy - (x > 21 ? 1 : 0), K);
      break;
  }
}

/** Serialise a grid to a compact, crisp SVG (one path per colour). */
export function gridToSvgBody(g: Grid): string {
  const byColor = new Map<string, string[]>();
  for (let y = 0; y < SPRITE_H; y++) {
    let x = 0;
    while (x < SPRITE_W) {
      const c = g.get(x, y);
      if (!c) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < SPRITE_W && g.get(x + run, y) === c) run++;
      const list = byColor.get(c) ?? [];
      list.push(`M${x} ${y}h${run}v1h-${run}z`);
      byColor.set(c, list);
      x += run;
    }
  }
  let out = '';
  for (const [c, d] of byColor) out += `<path fill="${c}" d="${d.join('')}"/>`;
  return out;
}

const cache = new Map<string, string>();

/** Render a frame to an SVG string (memoised). */
export function renderSprite(opts: FrameOptions, scale = 1): string {
  const k = JSON.stringify([opts, scale]);
  const hit = cache.get(k);
  if (hit) return hit;
  const body = gridToSvgBody(buildFrame(opts));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_W} ${SPRITE_H}" width="${SPRITE_W * scale}" height="${SPRITE_H * scale}" shape-rendering="crispEdges">${body}</svg>`;
  if (cache.size > 400) cache.clear();
  cache.set(k, svg);
  return svg;
}

export type { Grid };
