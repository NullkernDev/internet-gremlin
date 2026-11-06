/**
 * Original chiptune soundtrack + sound effects for the promo video,
 * synthesised entirely in code (no samples, no third-party music).
 *
 * It reads promo/demo/events.json — a time-stamped log of every story beat
 * and every reaction of the real Gremlin engine, written while the demo was
 * recorded — so music sections and sound effects land exactly on the picture.
 *
 *   npx tsx scripts/soundtrack.ts            → .scratch/soundtrack.wav
 *   npx tsx scripts/soundtrack.ts --mux      → also muxes it into promo/demo.mp4
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const SR = 44100;
const DURATION = 30;
const N = SR * DURATION;

interface DemoEvent {
  t: number;
  type: string;
  name: string;
}
interface EventFile {
  videoOffset: number;
  events: DemoEvent[];
}

// ------------------------------------------------------------------ synth core
type Wave = 'sine' | 'square' | 'triangle' | 'saw' | 'noise';
type Bus = 'music' | 'sfx';

interface Tone {
  t: number;
  dur: number;
  f0: number;
  f1?: number;
  wave?: Wave;
  vol?: number;
  duty?: number;
  attack?: number;
  env?: 'exp' | 'sustain' | 'lin';
  decay?: number;
  vib?: [number, number];
  trem?: [number, number];
  pan?: number;
  lp?: number;
  hp?: number;
  bus?: Bus;
}

const buses: Record<Bus, [Float32Array, Float32Array]> = {
  music: [new Float32Array(N), new Float32Array(N)],
  sfx: [new Float32Array(N), new Float32Array(N)],
};

let seed = 1234567;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function tone(o: Tone): void {
  const start = Math.floor(o.t * SR);
  const len = Math.floor(o.dur * SR);
  const wave = o.wave ?? 'square';
  const vol = o.vol ?? 0.2;
  const duty = o.duty ?? 0.5;
  const attack = Math.max(0.002, o.attack ?? 0.005);
  const env = o.env ?? 'exp';
  const k = o.decay ?? 5;
  const pan = o.pan ?? 0;
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  const [L, R] = buses[o.bus ?? 'sfx'];
  const lpA = o.lp ? 1 - Math.exp((-2 * Math.PI * o.lp) / SR) : 1;
  const hpA = o.hp ? Math.exp((-2 * Math.PI * o.hp) / SR) : 0;
  let phase = 0;
  let lpS = 0;
  let hpPrevIn = 0;
  let hpS = 0;
  let noiseVal = 0;
  let noisePhase = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= N) continue;
    const tt = i / SR;
    const p = i / len;
    let f = o.f1 ? o.f0 * Math.pow(o.f1 / o.f0, p) : o.f0;
    if (o.vib) f *= 1 + o.vib[1] * Math.sin(2 * Math.PI * o.vib[0] * tt);
    phase += f / SR;
    const ph = phase % 1;
    let s: number;
    switch (wave) {
      case 'sine':
        s = Math.sin(2 * Math.PI * ph);
        break;
      case 'square':
        s = ph < duty ? 1 : -1;
        break;
      case 'triangle':
        s = 4 * Math.abs(ph - 0.5) - 1;
        break;
      case 'saw':
        s = 2 * ph - 1;
        break;
      case 'noise':
        noisePhase += f / SR;
        if (noisePhase >= 1) {
          noisePhase -= 1;
          noiseVal = rand() * 2 - 1;
        }
        s = noiseVal;
        break;
    }
    let e: number;
    if (tt < attack) e = tt / attack;
    else if (env === 'exp') e = Math.exp((-k * (tt - attack)) / o.dur);
    else if (env === 'lin') e = 1 - p;
    else e = p > 0.9 ? (1 - p) / 0.1 : 1;
    if (o.trem) e *= 1 - o.trem[1] * (0.5 + 0.5 * Math.sin(2 * Math.PI * o.trem[0] * tt));
    // filters
    lpS += lpA * (s - lpS);
    let y = lpS;
    if (o.hp) {
      hpS = hpA * (hpS + y - hpPrevIn);
      hpPrevIn = y;
      y = hpS;
    }
    const v = y * e * vol;
    L[idx] += v * gl;
    R[idx] += v * gr;
  }
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ------------------------------------------------------------------ instruments
const M = { bus: 'music' as Bus };
const kick = (t: number, v = 0.75) => tone({ ...M, t, dur: 0.22, f0: 150, f1: 42, wave: 'sine', vol: v, decay: 6 });
const snare = (t: number, v = 0.28) => {
  tone({ ...M, t, dur: 0.16, f0: 9000, wave: 'noise', vol: v, hp: 1200, decay: 7 });
  tone({ ...M, t, dur: 0.08, f0: 200, f1: 150, wave: 'triangle', vol: v * 0.8, decay: 6 });
};
const hat = (t: number, v = 0.07, open = false) => tone({ ...M, t, dur: open ? 0.12 : 0.035, f0: 14000, wave: 'noise', vol: v, hp: 6500, decay: 6, pan: 0.3 });
const bass = (t: number, m: number, d: number, v = 0.32) => tone({ ...M, t, dur: d, f0: midi(m), wave: 'triangle', vol: v, env: 'sustain' });
const lead = (t: number, m: number, d: number, v = 0.11, duty = 0.25) =>
  tone({ ...M, t, dur: d, f0: midi(m), wave: 'square', duty, vol: v, env: 'exp', decay: 2.2, vib: [6, 0.006], lp: 5200, pan: -0.15 });
const bell = (t: number, m: number, d = 1.2, v = 0.16, pan = 0.2) => {
  tone({ ...M, t, dur: d, f0: midi(m), wave: 'sine', vol: v, decay: 5, pan });
  tone({ ...M, t, dur: d * 0.6, f0: midi(m + 12), wave: 'sine', vol: v * 0.35, decay: 6, pan });
};
const pad = (t: number, notes: number[], d: number, v = 0.035) =>
  notes.forEach((m, i) => tone({ ...M, t, dur: d, f0: midi(m), wave: 'triangle', vol: v, attack: 0.25, env: 'sustain', pan: i % 2 ? 0.4 : -0.4, vib: [4.5, 0.004] }));
const crash = (t: number, v = 0.16) => tone({ ...M, t, dur: 1.4, f0: 12000, wave: 'noise', vol: v, hp: 3500, decay: 4 });

// ------------------------------------------------------------------ sound effects
const S = { bus: 'sfx' as Bus };
const sfx = {
  whoosh: (t: number) => tone({ ...S, t, dur: 0.6, f0: 600, f1: 5000, wave: 'noise', vol: 0.22, attack: 0.3, env: 'lin', lp: 3000, hp: 300 }),
  pop: (t: number) => {
    tone({ ...S, t, dur: 0.12, f0: 280, f1: 1100, wave: 'sine', vol: 0.45 });
    tone({ ...S, t: t + 0.05, dur: 0.25, f0: 1800, f1: 2600, wave: 'square', duty: 0.125, vol: 0.06, lp: 6000 });
  },
  boing: (t: number, big = false) => tone({ ...S, t, dur: big ? 0.42 : 0.26, f0: big ? 180 : 260, f1: big ? 760 : 620, wave: 'square', duty: 0.25, vol: 0.13, vib: [22, 0.05], lp: 3800 }),
  squish: (t: number) => tone({ ...S, t, dur: 0.22, f0: 320, f1: 140, wave: 'square', duty: 0.4, vol: 0.12, vib: [30, 0.08], lp: 2200 }),
  land: (t: number) => tone({ ...S, t, dur: 0.15, f0: 120, f1: 50, wave: 'sine', vol: 0.5 }),
  shake: (t: number) => {
    for (let i = 0; i < 6; i++) tone({ ...S, t: t + i * 0.07, dur: 0.05, f0: 7000, wave: 'noise', vol: 0.1, hp: 2500 });
  },
  click: (t: number) => {
    tone({ ...S, t, dur: 0.018, f0: 16000, wave: 'noise', vol: 0.28, hp: 2000, decay: 8 });
    tone({ ...S, t, dur: 0.03, f0: 2400, wave: 'square', duty: 0.5, vol: 0.05, decay: 8 });
  },
  tab: (t: number, n: number) => tone({ ...S, t, dur: 0.06, f0: midi(70 + n), wave: 'square', duty: 0.125, vol: 0.06, lp: 6000, pan: -0.4 }),
  yawn: (t: number) => {
    tone({ ...S, t, dur: 1.3, f0: 520, f1: 210, wave: 'saw', vol: 0.09, attack: 0.25, lp: 1100, vib: [5, 0.02] });
    tone({ ...S, t: t + 0.1, dur: 1.1, f0: 1500, wave: 'noise', vol: 0.03, attack: 0.3, lp: 1500, hp: 400 });
  },
  snore: (t: number, until: number) => {
    for (let x = t; x < until - 0.6; x += 1.5) {
      tone({ ...S, t: x, dur: 0.75, f0: 900, wave: 'noise', vol: 0.05, attack: 0.4, env: 'lin', lp: 700, hp: 120 });
      tone({ ...S, t: x + 0.8, dur: 0.6, f0: 1400, f1: 1900, wave: 'sine', vol: 0.025, attack: 0.2, env: 'lin' });
    }
  },
  alarm: (t: number) => {
    tone({ ...S, t, dur: 0.1, f0: midi(88), wave: 'square', duty: 0.5, vol: 0.09, env: 'sustain', lp: 5000 });
    tone({ ...S, t: t + 0.11, dur: 0.16, f0: midi(93), wave: 'square', duty: 0.5, vol: 0.09, env: 'sustain', lp: 5000 });
    tone({ ...S, t, dur: 0.5, f0: 9000, wave: 'noise', vol: 0.12, hp: 2000, decay: 6 });
  },
  grumble: (t: number) => tone({ ...S, t, dur: 0.7, f0: 110, f1: 90, wave: 'square', duty: 0.3, vol: 0.12, trem: [14, 0.7], lp: 900 }),
  wail: (t: number) => tone({ ...S, t, dur: 1.2, f0: 720, f1: 360, wave: 'sine', vol: 0.12, attack: 0.08, vib: [7, 0.04], env: 'sustain' }),
  chime: (t: number) => [84, 88, 91, 96].forEach((m, i) => tone({ ...S, t: t + i * 0.07, dur: 0.6, f0: midi(m), wave: 'sine', vol: 0.09, decay: 6, pan: 0.3 - i * 0.2 })),
  purr: (t: number) => {
    for (let i = 0; i < 6; i++) tone({ ...S, t: t + i * 0.11, dur: 0.1, f0: 85, wave: 'triangle', vol: 0.22, env: 'exp', decay: 3 });
  },
  zap: (t: number) => tone({ ...S, t, dur: 0.3, f0: 1600, f1: 70, wave: 'saw', vol: 0.08, lp: 4000 }),
  twinkle: (t: number) => [96, 100, 103].forEach((m, i) => tone({ ...S, t: t + i * 0.09, dur: 0.35, f0: midi(m), wave: 'sine', vol: 0.06, decay: 6, pan: 0.5 })),
  /** Gibberish "voice", pitched by mood. */
  voice: (t: number, mood: string, syllables = 7) => {
    const base = { ANGRY: 52, DRAMATIC: 60, SHOCKED: 70, EXCITED: 68, AFFECTIONATE: 66, SLEEPING: 50, BORED: 55 }[mood] ?? 62;
    for (let i = 0; i < syllables; i++) {
      const m = base + Math.floor(rand() * 7) - 2 + (i === syllables - 1 && mood !== 'ANGRY' ? 4 : 0);
      tone({ ...S, t: t + i * 0.075, dur: 0.06, f0: midi(m), f1: midi(m - 1), wave: 'square', duty: 0.25, vol: 0.05, lp: 3200, decay: 3 });
    }
  },
};

// ------------------------------------------------------------------ score
function compose(file: EventFile): void {
  const off = file.videoOffset;
  const ev = file.events.map((e) => ({ ...e, t: e.t + off }));
  const find = (type: string, name?: string) => ev.find((e) => e.type === type && (name === undefined || e.name === name))?.t;
  const sec = {
    open: find('open') ?? 0.3,
    appear: find('appear') ?? 1.1,
    s2: find('scene', '02') ?? 3.9,
    s3: find('scene', '03') ?? 9.0,
    s4: find('scene', '04') ?? 15.3,
    s5: find('scene', '05') ?? 19.1,
    s6: find('scene', '06') ?? 23.9,
    end: find('end') ?? 27.3,
  };
  const B = 0.5; // 120 bpm
  const grid = (from: number, to: number, step: number, fn: (t: number, i: number) => void) => {
    for (let t = from, i = 0; t < to - 0.01; t += step, i++) fn(t, i);
  };

  // A — intro: soft arpeggio fades in
  grid(sec.appear, sec.s2, B / 2, (t, i) => {
    const arp = [60, 64, 67, 72, 67, 64];
    tone({ ...M, t, dur: 0.22, f0: midi(arp[i % arp.length] + 12), wave: 'triangle', vol: 0.05 + 0.08 * Math.min(1, (t - sec.appear) / 2), decay: 4, pan: 0.2 });
  });
  pad(sec.open + 0.3, [48, 55, 64], sec.s2 - sec.open - 0.3);
  grid(sec.s2 - 1, sec.s2, B / 2, (t) => hat(t, 0.04));

  // B — groove while clicking around
  const prog = [
    { root: 36, lead: [72, 76, 79, 76, 74, 72, 74, 76] },
    { root: 33, lead: [76, 74, 72, 69, 72, 74, 76, 79] },
    { root: 41, lead: [77, 76, 74, 72, 74, 76, 77, 81] },
    { root: 43, lead: [79, 77, 76, 74, 71, 74, 79, 79] },
  ];
  grid(sec.s2, sec.s3, B / 2, (t, i) => {
    const bar = prog[Math.floor(i / 8) % 4];
    const step = i % 8;
    if (step % 2 === 0) kick(t, step === 0 ? 0.8 : 0.6);
    if (step === 2 || step === 6) snare(t);
    hat(t, step % 2 ? 0.05 : 0.07);
    bass(t, bar.root + (step % 4 === 2 ? 12 : 0), B / 2 - 0.02);
    lead(t, bar.lead[step], B / 2 - 0.03);
  });
  crash(sec.s2, 0.12);

  // C — idle: drums drop out, a sleepy music-box lullaby
  pad(sec.s3, [48, 55, 59, 64], sec.s4 - sec.s3, 0.03);
  const lullaby = [79, 76, 72, 76, 77, 74, 71, 74, 72, 67];
  grid(sec.s3 + 0.2, sec.s4 - 0.3, 0.72, (t, i) => bell(t, lullaby[i % lullaby.length], 1.4, 0.13 * Math.max(0.35, 1 - i * 0.07)));

  // D — grumpy wake-up: stab, then a stomping minor bassline
  const shock = ev.find((e) => e.type === 'mood' && e.name === 'SHOCKED' && e.t >= sec.s4)?.t ?? sec.s4 + 0.5;
  tone({ ...M, t: shock, dur: 0.5, f0: midi(45), wave: 'saw', vol: 0.12, lp: 1400, decay: 4 });
  crash(shock, 0.14);
  const grumpy = [45, 45, 48, 45, 43, 43, 40, 43];
  grid(shock + 0.6, sec.s5, B / 2, (t, i) => {
    if (i % 4 === 0) kick(t, 0.7);
    if (i % 8 === 6) snare(t, 0.22);
    bass(t, grumpy[i % 8] - 12, 0.18, 0.36);
    if (i % 2 === 0) hat(t, 0.04);
  });

  // E — panic: four-on-the-floor, 16th hats, rising tension
  const panic = ev.find((e) => e.type === 'mood' && e.name === 'SHOCKED' && e.t >= sec.s5)?.t ?? sec.s5 + 2.4;
  grid(sec.s5, sec.s6, B / 4, (t, i) => {
    const lift = t > panic ? 1 : 0;
    if (i % 4 === 0) kick(t, 0.7);
    if (i % 8 === 4) snare(t, 0.26);
    hat(t, i % 2 ? 0.04 : 0.06);
    if (i % 2 === 0) bass(t, 33 + lift + (i % 4 === 2 ? 12 : 0), 0.12, 0.34);
    const arp = [69, 72, 76, 81, 76, 72];
    lead(t, arp[i % arp.length] + lift + (i >= 16 ? 2 : 0), B / 4 - 0.02, 0.08, 0.125);
  });
  crash(panic, 0.15);
  tone({ ...S, t: panic + 0.3, dur: 1.6, f0: 700, wave: 'square', duty: 0.5, vol: 0.05, vib: [3, 0.25], lp: 2500, env: 'sustain' }); // siren

  // F — love: sweet and soft
  const loveProg = [
    { root: 41, mel: [77, 76, 72, 76] },
    { root: 43, mel: [79, 77, 74, 77] },
    { root: 36, mel: [76, 79, 84, 79] },
    { root: 45, mel: [76, 72, 69, 72] },
  ];
  grid(sec.s6, sec.end, B / 2, (t, i) => {
    const bar = loveProg[Math.floor(i / 4) % 4];
    if (i % 4 === 0) kick(t, 0.45);
    if (i % 2 === 1) hat(t, 0.035);
    bass(t, bar.root, B / 2 - 0.03, 0.28);
    tone({ ...M, t, dur: B / 2, f0: midi(bar.mel[i % 4]), wave: 'triangle', vol: 0.12, decay: 2.5, vib: [5, 0.008] });
  });
  pad(sec.s6, [53, 57, 60, 64], sec.end - sec.s6, 0.03);

  // G — end card fanfare
  const e0 = sec.end;
  crash(e0, 0.2);
  kick(e0, 0.9);
  [67, 72, 76].forEach((m, i) => lead(e0 + 0.12 + i * 0.12, m, 0.12, 0.13, 0.5));
  lead(e0 + 0.48, 79, 1.0, 0.13, 0.5);
  [36, 48].forEach((m) => tone({ ...M, t: e0 + 0.48, dur: 2.0, f0: midi(m), wave: 'triangle', vol: 0.3, env: 'exp', decay: 2.5 }));
  pad(e0 + 0.48, [60, 64, 67, 72], DURATION - e0 - 0.5, 0.05);
  [84, 88, 91, 96, 100].forEach((m, i) => bell(e0 + 1.0 + i * 0.12, m, 1.6, 0.07, -0.4 + i * 0.2));
  kick(e0 + 1.5, 0.5);

  // ---- sound effects from the engine's own event log
  let mood = 'IDLE';
  let sleepingSince: number | null = null;
  for (const e of ev) {
    const t = e.t;
    if (e.type === 'open') sfx.whoosh(t);
    if (e.type === 'appear') sfx.pop(t + 0.15);
    if (e.type === 'click') sfx.click(t);
    if (e.type === 'tab') sfx.tab(t, Number(e.name) % 12);
    if (e.type === 'shot') {
      if (e.name === 'jump' || e.name === 'reunion' || e.name === 'flip') sfx.boing(t, e.name !== 'jump');
      else if (e.name === 'hop') sfx.boing(t);
      else if (e.name === 'squish') sfx.squish(t);
      else if (e.name === 'land') sfx.land(t + 0.1);
      else if (e.name === 'shake') sfx.shake(t);
      else if (e.name === 'yawn') sfx.yawn(t);
      else if (e.name === 'nod') sfx.squish(t);
    }
    if (e.type === 'fx' && (e.name === 'hearts' || e.name === 'confetti')) sfx.chime(t);
    if (e.type === 'fx' && e.name === 'sparkle') sfx.twinkle(t);
    if (e.type === 'sound' && e.name === 'purr') sfx.purr(t);
    if (e.type === 'sound' && e.name === 'zap') sfx.zap(t);
    if (e.type === 'say') sfx.voice(t + 0.05, mood);
    if (e.type === 'mood') {
      if (sleepingSince !== null && e.name !== 'SLEEPING') {
        sfx.snore(sleepingSince + 0.5, t);
        sleepingSince = null;
      }
      if (e.name === 'SLEEPING') sleepingSince = t;
      if (e.name === 'SHOCKED') sfx.alarm(t);
      if (e.name === 'ANGRY') sfx.grumble(t + 0.1);
      if (e.name === 'DRAMATIC') sfx.wail(t + 0.1);
      mood = e.name;
    }
    if (e.type === 'end') sfx.whoosh(t - 0.4);
  }
  if (sleepingSince !== null) sfx.snore(sleepingSince + 0.5, sec.s4);
}

// ------------------------------------------------------------------ mixdown
function mixdown(): Buffer {
  const [mL, mR] = buses.music;
  const [sL, sR] = buses.sfx;
  const out = new Int16Array(N * 2);
  // gentle low-pass on the music bus for warmth
  const a = 1 - Math.exp((-2 * Math.PI * 7000) / SR);
  let lpL = 0;
  let lpR = 0;
  let peak = 0;
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    lpL += a * (mL[i] - lpL);
    lpR += a * (mR[i] - lpR);
    const fade = Math.min(1, i / (SR * 0.15), (N - i) / (SR * 0.8));
    L[i] = (lpL * 0.8 + sL[i]) * fade;
    R[i] = (lpR * 0.8 + sR[i]) * fade;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const gain = 0.89 / Math.max(peak, 1e-6);
  for (let i = 0; i < N; i++) {
    out[i * 2] = Math.round(Math.tanh(L[i] * gain * 1.1) * 32767 * 0.95);
    out[i * 2 + 1] = Math.round(Math.tanh(R[i] * gain * 1.1) * 32767 * 0.95);
  }
  const data = Buffer.from(out.buffer);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

export function buildSoundtrack(eventsPath = join(root, 'promo/demo/events.json'), outPath = join(root, '.scratch/soundtrack.wav')): string {
  const file = JSON.parse(readFileSync(eventsPath, 'utf8')) as EventFile;
  compose(file);
  mkdirSync(resolve(outPath, '..'), { recursive: true });
  writeFileSync(outPath, mixdown());
  return outPath;
}

/** Replace the audio track of promo/demo.mp4 with the soundtrack. */
export function muxSoundtrack(wav: string, mp4 = join(root, 'promo/demo.mp4')): void {
  const silent = join(root, '.scratch/demo-silent.mp4');
  if (!existsSync(silent)) copyFileSync(mp4, silent);
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error('muxing failed');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const wav = buildSoundtrack();
  console.log(`✔ ${wav}`);
  if (process.argv.includes('--mux')) {
    muxSoundtrack(wav);
    console.log('✔ promo/demo.mp4 now has sound');
  }
}
