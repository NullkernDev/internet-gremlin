/**
 * Tiny synthesised sound effects (Web Audio, no audio files, no network).
 * Off by default; only plays after the user has interacted with the page,
 * which is when browsers allow audio anyway.
 */
type SoundName = 'squeak' | 'purr' | 'chomp' | 'blip' | 'boing' | 'zap';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(type: OscillatorType, from: number, to: number, dur: number, vol = 0.04, delay = 0): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function playSound(name: SoundName): void {
  switch (name) {
    case 'squeak':
      tone('square', 900, 1500, 0.09, 0.03);
      break;
    case 'blip':
      for (let i = 0; i < 3; i++) tone('square', 420 + Math.random() * 380, 380 + Math.random() * 300, 0.05, 0.018, i * 0.07);
      break;
    case 'purr':
      for (let i = 0; i < 4; i++) tone('triangle', 90, 70, 0.09, 0.05, i * 0.1);
      break;
    case 'chomp':
      tone('square', 220, 90, 0.07, 0.04);
      tone('square', 240, 100, 0.07, 0.04, 0.14);
      break;
    case 'boing':
      tone('sine', 200, 700, 0.18, 0.05);
      break;
    case 'zap':
      tone('sawtooth', 1400, 80, 0.25, 0.025);
      break;
  }
}
