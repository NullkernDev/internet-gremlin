/**
 * The Gremlin's brain: a priority-based state machine.
 *
 * It knows nothing about the DOM. The content script feeds it interaction
 * events (clicks, scrolls, pokes, tab counts…) plus a regular tick, and it
 * answers with a Snapshot (what the creature looks like right now) and a
 * stream of Outputs (speech, secrets, relationship changes, movement).
 *
 * Design rules that keep it from being annoying:
 *  - Every reaction is probabilistic and most have their own cooldown.
 *  - Higher-priority moods can't be interrupted until their minimum time ends.
 *  - Unprompted speech has a global gap that depends on personality intensity.
 */
import type { Arms, Expression } from '../sprite/sprite';
import type { Intensity, PetState } from '../shared/types';
import { NOTE_ITEMS, THOUGHTS, type DialogueEvent, type Tier } from './dialogue';
import { MOOD_CONFIG, MOODS, type Fx, type LoopAnim, type Mood, type OneShot } from './moods';
import { daysTogether, EFFECTS, tierOf, type Delta } from './relationship';
import { Speaker } from './speech';

export type Snack = 'cookie' | 'byte' | 'bug';

export interface Snapshot {
  mood: Mood;
  expression: Expression;
  loop: LoopAnim;
  oneShot: { name: OneShot; id: number } | null;
  fx: Fx | null;
  fxId: number;
  arms?: Arms;
  golden: boolean;
  /** Eyes wander on their own instead of following the cursor. */
  lookAround: boolean;
  /** Eyes locked straight ahead (The Stare). */
  stare: boolean;
  /** 'duck' while hiding from the cursor, 'glitch' while teleporting. */
  hidden: null | 'duck' | 'glitch';
}

export type Output =
  | { type: 'say'; text: string; ttl: number; id: string }
  | { type: 'teleport' }
  | { type: 'wander' }
  | { type: 'dodge' }
  | { type: 'note'; items: string[] }
  | { type: 'secret'; id: string }
  | { type: 'delta'; delta: Delta }
  | { type: 'pet'; patch: (p: PetState) => Partial<PetState> }
  | { type: 'sound'; name: 'squeak' | 'purr' | 'chomp' | 'blip' | 'boing' | 'zap' };

interface IntensityProfile {
  speechGap: number;
  ambient: [number, number];
  react: number;
}

const INTENSITY: Record<Intensity, IntensityProfile> = {
  chill: { speechGap: 55_000, ambient: [90_000, 180_000], react: 0.55 },
  normal: { speechGap: 22_000, ambient: [40_000, 95_000], react: 1 },
  unhinged: { speechGap: 8_000, ambient: [16_000, 40_000], react: 1.7 },
};

/** Inactivity ladder (ms of no input). */
export const IDLE_STEPS = { look: 25_000, yawn: 60_000, sleep: 120_000, complain: [6 * 60_000, 15 * 60_000] };

export interface BrainOptions {
  pet: PetState;
  intensity: Intensity;
  rng?: () => number;
  /** Speeds up the inactivity ladder and ambient schedule (used by the promo demo). */
  timeScale?: number;
  now?: number;
  wander?: boolean;
  name?: string;
  /** Random unprompted behaviour. Disabled only by the scripted promo demo. */
  ambient?: boolean;
}

interface Pending {
  at: number;
  run: () => void;
}

const RESTING: Mood[] = ['IDLE', 'BORED', 'SLEEPING'];

export class Brain {
  private rng: () => number;
  private ps: PetState;
  private intensity: IntensityProfile;
  private timeScale: number;
  private speaker: Speaker;
  private listeners = new Set<(s: Snapshot) => void>();
  private outListeners = new Set<(o: Output) => void>();
  wander: boolean;
  name: string;
  private ambientOn: boolean;

  private snap: Snapshot;
  private moodSince: number;
  private exprOverride: { expr: Expression; until: number; arms?: Arms } | null = null;
  private goldenUntil = 0;
  private stareUntil = 0;
  private hiddenUntil = 0;
  private oneShotId = 0;
  private fxId = 0;

  private lastActivity: number;
  private lastSpoke = -Infinity;
  private nextAmbient: number;
  private complaintsDone = 0;
  private clicks: number[] = [];
  private pokes: number[] = [];
  private gestures: { g: 'poke' | 'pet'; t: number }[] = [];
  private snacks: number[] = [];
  private scrollAcc: { t: number; d: number }[] = [];
  private cooldowns = new Map<string, number>();
  private pending: Pending[] = [];
  private hiddenAt: number | null = null;
  private tabLevel = 0;
  private lastPetAt = -Infinity;
  private pendingTime = 0;
  private lastTick: number;
  private sessionActive = 0;
  private togetherAcc = 0;
  private marathonDone = false;
  private tabAgeAnnounced = 1;
  private readonly pageOpened: number;
  private midnightDone = false;
  private lastThoughtAt = -Infinity;
  private shaken = false;

  constructor(opts: BrainOptions) {
    this.rng = opts.rng ?? Math.random;
    this.ps = opts.pet;
    this.intensity = INTENSITY[opts.intensity];
    this.timeScale = opts.timeScale ?? 1;
    this.wander = opts.wander ?? true;
    this.name = opts.name ?? 'Gorp';
    this.ambientOn = opts.ambient ?? true;
    const now = opts.now ?? Date.now();
    this.pageOpened = now;
    this.lastActivity = now;
    this.lastTick = now;
    this.moodSince = now;
    this.nextAmbient = now + this.ambientDelay();
    this.speaker = new Speaker(opts.pet.recentLines, this.rng);
    this.snap = {
      mood: 'IDLE',
      expression: 'neutral',
      loop: 'breathe',
      oneShot: null,
      fx: null,
      fxId: 0,
      golden: false,
      lookAround: false,
      stare: false,
      hidden: null,
    };
  }

  // ---------------------------------------------------------------- plumbing
  onChange(cb: (s: Snapshot) => void): () => void {
    this.listeners.add(cb);
    cb(this.snap);
    return () => this.listeners.delete(cb);
  }
  onOutput(cb: (o: Output) => void): () => void {
    this.outListeners.add(cb);
    return () => this.outListeners.delete(cb);
  }
  get snapshot(): Snapshot {
    return this.snap;
  }
  get tier(): Tier {
    return tierOf(this.ps);
  }
  get recentLines(): string[] {
    return this.speaker.recentIds;
  }
  setPet(p: PetState): void {
    this.ps = p;
  }
  setIntensity(i: Intensity): void {
    this.intensity = INTENSITY[i];
  }

  private emit(o: Output): void {
    this.outListeners.forEach((l) => l(o));
  }
  private publish(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l(this.snap));
  }
  private chance(p: number): boolean {
    return this.rng() < Math.min(0.95, p * this.intensity.react);
  }
  private pickOne<T>(list: T[]): T {
    return list[Math.floor(this.rng() * list.length)];
  }
  private cool(key: string, ms: number, now: number): boolean {
    if ((this.cooldowns.get(key) ?? -Infinity) > now) return false;
    this.cooldowns.set(key, now + ms);
    return true;
  }
  private later(ms: number, now: number, run: () => void): void {
    this.pending.push({ at: now + ms, run });
  }
  private ambientDelay(): number {
    const [a, b] = this.intensity.ambient;
    return (a + this.rng() * (b - a)) / this.timeScale;
  }
  private secret(id: string): void {
    if (!this.ps.secrets.includes(id)) this.emit({ type: 'secret', id });
  }
  private delta(d: Delta): void {
    this.emit({ type: 'delta', delta: d });
  }

  /** Say something. `force` is for direct responses to the owner. */
  say(event: DialogueEvent, now: number, opts: { force?: boolean; chance?: number; vars?: Record<string, string | number> } = {}): boolean {
    const gap = opts.force ? 1200 : this.intensity.speechGap;
    if (now - this.lastSpoke < gap) return false;
    if (opts.chance !== undefined && !this.chance(opts.chance)) return false;
    const line = this.speaker.pick(event, { mood: this.snap.mood, tier: this.tier }, now);
    if (!line) return false;
    const vars = {
      name: this.name,
      visits: this.ps.visits,
      days: daysTogether(this.ps, now),
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...opts.vars,
    };
    const text = Speaker.format(line.text, vars);
    this.lastSpoke = now;
    const ttl = Math.max(2600, Math.min(7000, 1600 + text.length * 60));
    this.emit({ type: 'say', text, ttl, id: line.id });
    this.emit({ type: 'sound', name: 'blip' });
    if (line.r === 'l') this.secret('nonsequitur');
    return true;
  }

  // ------------------------------------------------------------- mood control
  /** Try to enter a mood. Returns false if a higher-priority mood is busy. */
  setMood(
    mood: Mood,
    now: number,
    opts: { force?: boolean; expression?: Expression; oneShot?: OneShot; fx?: Fx | null; loop?: LoopAnim; arms?: Arms } = {},
  ): boolean {
    const cur = MOOD_CONFIG[this.snap.mood];
    const next = MOOD_CONFIG[mood];
    const busy = now - this.moodSince < cur.minMs && cur.priority > next.priority;
    if (busy && !opts.force) return false;
    const expression = opts.expression ?? this.expressionFor(mood);
    this.moodSince = now;
    this.exprOverride = null;
    const fx = opts.fx === undefined ? (next.fx ?? null) : opts.fx;
    if (fx) this.fxId++;
    this.publish({
      mood,
      expression,
      loop: opts.loop ?? next.loop,
      arms: opts.arms ?? next.arms,
      fx,
      fxId: this.fxId,
      lookAround: false,
      stare: false,
      golden: now < this.goldenUntil,
      ...(opts.oneShot ? { oneShot: { name: opts.oneShot, id: ++this.oneShotId } } : {}),
    });
    this.noteSeen(expression);
    // the tiniest chance of golden eyes on any mood change
    if (this.rng() < 0.0025) this.golden(now);
    return true;
  }

  private expressionFor(mood: Mood): Expression {
    const t = this.tier;
    if (mood === 'IDLE') {
      if (this.ps.chaos > 60 && this.rng() < 0.3) return 'innocent';
      if (t === 0 && this.rng() < 0.35) return 'suspicious';
      return 'neutral';
    }
    if (mood === 'JEALOUS') return t >= 2 ? 'sad' : 'suspicious';
    if (mood === 'AFFECTIONATE') return t === 0 ? 'happy' : 'love';
    return this.pickOne(MOOD_CONFIG[mood].expressions);
  }

  private noteSeen(e: Expression): void {
    if (!this.ps.seen.includes(e)) {
      this.ps = { ...this.ps, seen: [...this.ps.seen, e] };
      this.emit({ type: 'pet', patch: (p) => ({ seen: p.seen.includes(e) ? p.seen : [...p.seen, e] }) });
    }
  }

  oneShot(name: OneShot): void {
    this.publish({ oneShot: { name, id: ++this.oneShotId } });
  }

  private fx(fx: Fx): void {
    this.publish({ fx, fxId: ++this.fxId });
  }

  private override(expr: Expression, ms: number, now: number, arms?: Arms): void {
    this.exprOverride = { expr, until: now + ms, arms };
    this.publish({ expression: expr, arms: arms ?? this.snap.arms });
    this.noteSeen(expr);
  }

  private golden(now: number): void {
    this.goldenUntil = now + 6000;
    this.publish({ golden: true });
    this.fx('sparkle');
    this.secret('golden');
    this.emit({ type: 'pet', patch: (p) => ({ goldenSightings: p.goldenSightings + 1 }) });
    this.say('golden', now, { force: true, chance: 0.8 });
  }

  // ------------------------------------------------------------------ session
  /** Called once when the Gremlin appears on a page. */
  start(now: number, ctx: { newSession: boolean; awayDays: number }): void {
    const d = new Date(now);
    const hour = d.getHours();
    const day = d.getDay();
    const t = this.tier;
    if (ctx.awayDays >= 3) {
      this.setMood('DRAMATIC', now, { force: true, expression: 'crying', oneShot: 'reunion' });
      this.say('neglect', now, { force: true, vars: { days: ctx.awayDays } });
      return;
    }
    if (!ctx.newSession) {
      if (this.chance(0.12)) this.say('greet', now, { force: true });
      return;
    }
    const days = daysTogether(this.ps, now);
    const milestone = [3, 7, 14, 30, 50, 100, 200, 365].find((m) => m === days && m > this.ps.lastMilestone);
    if (milestone) {
      this.setMood('EXCITED', now, { force: true, oneShot: 'reunion', fx: 'confetti' });
      this.say('milestone', now, { force: true, vars: { days } });
      this.emit({ type: 'pet', patch: () => ({ lastMilestone: milestone }) });
      return;
    }
    if (t >= 3) this.setMood('HAPPY', now, { force: true, oneShot: 'reunion', fx: 'hearts' });
    else if (t === 2) this.setMood('HAPPY', now, { force: true, oneShot: 'hop' });
    else if (t === 0) this.setMood('CURIOUS', now, { force: true, expression: 'suspicious', fx: null });
    if (hour === 0) this.midnight(now);
    else if (hour < 5) this.say('latenight', now, { force: true });
    else if (hour < 10 && this.chance(0.6)) this.say('morning', now, { force: true });
    else if (day === 5 && this.chance(0.5)) this.say('friday', now, { force: true });
    else if ((day === 0 || day === 6) && this.chance(0.4)) this.say('weekend', now, { force: true });
    else this.say('greet', now, { force: true });
  }

  private midnight(now: number): void {
    if (this.midnightDone) return;
    this.midnightDone = true;
    this.setMood('CHAOTIC', now, { force: true, expression: 'evil' });
    this.say('midnight', now, { force: true });
    this.secret('midnight');
  }

  // ------------------------------------------------------------------ inputs
  /** Any sign of life from the owner (mouse move, key press, scroll, click). */
  activity(now: number): void {
    const idle = now - this.lastActivity;
    this.lastActivity = now;
    const resting = RESTING.includes(this.snap.mood) || this.complaintsDone > 0;
    if (idle >= IDLE_STEPS.sleep / this.timeScale && resting) this.wake(now, idle);
    else if (this.snap.mood === 'BORED' || this.snap.lookAround) this.setMood('IDLE', now);
    this.complaintsDone = 0;
  }

  private wake(now: number, idle: number): void {
    const t = this.tier;
    const mins = Math.round(idle / 60_000);
    if (idle >= 5 * 60_000 / this.timeScale && this.chance(0.35)) {
      const items = [...NOTE_ITEMS].sort(() => this.rng() - 0.5).slice(0, 3);
      this.emit({ type: 'note', items });
      this.secret('note');
    }
    const r = this.rng();
    if (r < 0.15 + t * 0.06) {
      this.setMood('EXCITED', now, { force: true, oneShot: 'reunion', fx: 'hearts' });
      this.say('reunion', now, { force: true });
    } else if (r < 0.48) {
      this.setMood('SHOCKED', now, { force: true, oneShot: 'jump' });
      this.later(1500, now, () => {
        this.setMood('ANGRY', now + 1500, { force: true, expression: 'bored', fx: null, loop: 'sway', arms: 'crossed' });
        this.say('wakeGrumpy', now + 1500, { force: true });
      });
    } else if (r < 0.72) {
      this.setMood('IDLE', now, { force: true, expression: 'bored' });
      this.override('bored', 4000, now, 'crossed');
      this.say('wakeIgnore', now, { force: true });
    } else {
      this.setMood('HAPPY', now, { force: true, oneShot: 'hop' });
      this.say('wakeHappy', now, { force: true, vars: { mins } });
    }
  }

  pageClick(now: number): void {
    this.activity(now);
    this.clicks = [...this.clicks.filter((t) => now - t < 2500), now];
    if (this.clicks.length >= 7 && this.cool('clickSpam', 30_000, now)) {
      this.setMood(this.ps.chaos > 50 ? 'CHAOTIC' : 'EXCITED', now, { oneShot: 'jump' });
      this.say('clickSpam', now, { force: true });
      this.delta({ chaos: 1.5 });
      return;
    }
    if (!this.cool('clickReact', 3500, now)) return;
    const r = this.rng();
    if (r < 0.03 * this.intensity.react && this.snap.mood !== 'SLEEPING') {
      if (this.setMood('EXCITED', now, { oneShot: 'jump' })) this.say('click', now, { chance: 0.7 });
    } else if (r < 0.14 * this.intensity.react) {
      this.oneShot('hop');
    } else if (r < 0.2 * this.intensity.react) {
      this.say('click', now);
    }
  }

  scroll(dy: number, now: number): void {
    this.activity(now);
    this.scrollAcc = [...this.scrollAcc.filter((s) => now - s.t < 1200), { t: now, d: Math.abs(dy) }];
    const sum = this.scrollAcc.reduce((s, x) => s + x.d, 0);
    if (sum > 6000 && this.cool('scrollFast', 45_000, now)) {
      if (this.setMood('SHOCKED', now, { oneShot: 'jump' })) this.say('scrollFast', now, { force: true, chance: 0.8 });
    } else if (sum > 1600 && this.cool('scroll', 35_000, now) && this.chance(0.3)) {
      if (this.setMood('CURIOUS', now, { expression: 'neutral', fx: null })) this.say('scroll', now, { chance: 0.7 });
    }
  }

  private gesture(g: 'poke' | 'pet', now: number): boolean {
    this.gestures = [...this.gestures.filter((x) => now - x.t < 6000), { g, t: now }];
    const seq = this.gestures.slice(-4).map((x) => x.g).join(',');
    if (seq === 'poke,poke,pet,poke') {
      this.gestures = [];
      this.setMood('EXCITED', now, { force: true, oneShot: 'dance', fx: 'confetti' });
      this.say('handshake', now, { force: true });
      this.secret('handshake');
      this.delta({ affection: 3, trust: 2 });
      return true;
    }
    return false;
  }

  poke(now: number): void {
    this.activity(now);
    this.emit({ type: 'sound', name: 'squeak' });
    if (this.gesture('poke', now)) return;
    this.pokes = [...this.pokes.filter((t) => now - t < 5000), now];
    const n = this.pokes.length;
    if (n >= 12) {
      this.pokes = [];
      this.setMood('ANGRY', now, { force: true, oneShot: 'shake' });
      this.say('manager', now, { force: true });
      this.secret('manager');
      this.delta(EFFECTS.pokeSpam);
      this.later(1800, now, () => this.teleport(now + 1800));
      return;
    }
    if (n >= 5) {
      this.setMood('ANGRY', now, { force: true, oneShot: 'shake' });
      if (n === 5 || n === 8) this.say('pokeSpam', now, { force: true });
      this.delta(EFFECTS.pokeSpam);
      return;
    }
    this.delta(EFFECTS.poke);
    const t = this.tier;
    const mood = this.snap.mood;
    if (mood === 'SLEEPING') {
      if (this.rng() < 0.3) {
        this.override('suspicious', 1800, now);
        this.say('fakeSleep', now, { force: true });
        this.secret('possum');
        this.later(1800, now, () => this.publish({ expression: 'sleeping' }));
        return;
      }
      if (t >= 2 && this.rng() < 0.6) {
        this.setMood('HAPPY', now, { force: true, oneShot: 'jump' });
        this.say('wakeHappy', now, { force: true });
      } else {
        this.setMood('ANGRY', now, { force: true, oneShot: 'jump', expression: 'angry' });
        this.say('wakeGrumpy', now, { force: true });
      }
      return;
    }
    if (mood === 'ANGRY') {
      this.setMood('ANGRY', now, { force: true, oneShot: 'shake' });
      this.say('pokeSpam', now, { force: true, chance: 0.5 });
      return;
    }
    if (t === 0) {
      if (this.rng() < 0.55) this.setMood('SHOCKED', now, { force: true, oneShot: 'jump' });
      else this.setMood('CURIOUS', now, { force: true, expression: 'suspicious', oneShot: 'squish', fx: null });
    } else if (t >= 3 && this.rng() < 0.3) {
      this.setMood('AFFECTIONATE', now, { force: true, oneShot: 'hop' });
    } else {
      this.setMood('HAPPY', now, { force: true, oneShot: this.rng() < 0.5 ? 'squish' : 'jump', fx: null });
    }
    this.say('poke', now, { force: true, chance: t === 0 ? 0.9 : 0.6 });
  }

  pet(now: number): void {
    if (now - this.lastPetAt < 1500) return;
    this.lastPetAt = now;
    this.activity(now);
    this.emit({ type: 'sound', name: 'purr' });
    if (this.gesture('pet', now)) return;
    this.delta(EFFECTS.pet);
    if (this.snap.mood === 'SLEEPING') {
      this.fx('hearts');
      return;
    }
    if (this.forgiveStep(now)) return;
    const t = this.tier;
    if (t === 0 && this.ps.trust < 8 && this.rng() < 0.5) {
      this.setMood('CURIOUS', now, { force: true, expression: 'suspicious', fx: 'sweat' });
      this.say('petStranger', now, { force: true });
      return;
    }
    const dance = t >= 3 && this.rng() < 0.25;
    this.setMood('AFFECTIONATE', now, { force: true, oneShot: dance ? 'dance' : 'squish' });
    if (dance) this.secret('dance');
    this.say('pet', now, { force: true, chance: 0.75 });
  }

  /** Neglected gremlins forgive after a few nice interactions. */
  private forgiveStep(now: number): boolean {
    if (this.ps.grudge <= 0) return false;
    const left = this.ps.grudge - 1;
    this.ps = { ...this.ps, grudge: left };
    this.emit({ type: 'pet', patch: () => ({ grudge: left }) });
    if (left === 0) {
      this.setMood('AFFECTIONATE', now, { force: true, oneShot: 'hop' });
      this.say('forgive', now, { force: true });
    } else {
      this.setMood('JEALOUS', now, { force: true, expression: 'sad' });
      this.say('neglect', now, { force: true, chance: 0.4, vars: { days: '…so many' } });
    }
    return true;
  }

  feed(snack: Snack, now: number): void {
    this.activity(now);
    this.snacks = [...this.snacks.filter((t) => now - t < 10 * 60_000), now];
    if (this.snacks.length > 5) {
      this.setMood('DRAMATIC', now, { force: true, expression: 'exhausted', oneShot: 'squish', fx: 'sweat' });
      this.say('overfed', now, { force: true });
      this.secret('balloon');
      return;
    }
    this.emit({ type: 'sound', name: 'chomp' });
    this.delta(EFFECTS.feed);
    this.emit({ type: 'pet', patch: (p) => ({ snacksEaten: p.snacksEaten + 1 }) });
    if (this.forgiveStep(now)) return;
    this.setMood(snack === 'bug' ? 'CHAOTIC' : 'HAPPY', now, {
      force: true,
      expression: snack === 'bug' ? 'evil' : 'happy',
      oneShot: 'chomp',
      fx: 'crumbs',
      arms: 'hold',
    });
    const ev = snack === 'cookie' ? 'feedCookie' : snack === 'byte' ? 'feedByte' : 'feedBug';
    this.say(ev, now, { force: true });
  }

  dragStart(now: number): void {
    this.activity(now);
    this.shaken = false;
    this.setMood(this.tier === 0 ? 'SHOCKED' : 'EXCITED', now, { force: true, arms: 'up', fx: null });
    this.say('drag', now, { chance: 0.6 });
  }

  dragShake(now: number): void {
    if (!this.cool('shake', 2500, now)) return;
    this.shaken = true;
    this.setMood('CHAOTIC', now, { force: true, expression: 'dizzy', loop: 'spin' });
    this.say('shake', now, { force: true });
    this.delta(EFFECTS.shake);
  }

  dragCircle(now: number): void {
    if (!this.cool('washer', 8000, now)) return;
    this.shaken = true;
    this.setMood('CHAOTIC', now, { force: true, expression: 'dizzy', loop: 'spin' });
    this.say('washer', now, { force: true });
    this.secret('washer');
  }

  dragEnd(now: number): void {
    this.delta(EFFECTS.drag);
    if (this.shaken) {
      this.setMood('DRAMATIC', now, { force: true, expression: 'exhausted', oneShot: 'land', fx: 'sweat' });
    } else if (this.rng() < 0.45) {
      this.setMood('HAPPY', now, { force: true, expression: 'proud', oneShot: 'land', fx: null });
      this.say('drop', now, { force: true, chance: 0.8 });
    } else {
      this.setMood('IDLE', now, { force: true, oneShot: 'land' });
    }
  }

  /** The cursor rushed towards the Gremlin. */
  cursorRush(now: number): void {
    const mood = this.snap.mood;
    if (mood === 'SLEEPING' || this.snap.hidden) return;
    if ((mood === 'ANGRY' || mood === 'CHAOTIC') && this.cool('dodge', 20_000, now) && this.chance(0.5)) {
      this.emit({ type: 'dodge' });
      this.say('dodge', now, { force: true, chance: 0.6 });
      return;
    }
    if (this.cool('shy', 4 * 60_000, now) && this.chance(this.tier < 2 ? 0.3 : 0.12)) {
      this.hiddenUntil = now + 1500;
      this.publish({ hidden: 'duck' });
      this.say('hide', now, { force: true, chance: 0.7 });
      this.secret('shy');
    }
  }

  tabs(count: number, now: number): void {
    const levels = [10, 20, 35];
    const level = levels.filter((l) => count >= l).length;
    if (level < this.tabLevel) this.tabLevel = level;
    if (level > this.tabLevel) {
      this.tabLevel = level;
      if (level >= 2) {
        if (this.setMood('SHOCKED', now, { force: true, oneShot: 'jump' })) {
          this.say('tabsPanic', now, { force: true, vars: { tabs: count } });
          this.later(2200, now, () => this.setMood('DRAMATIC', now + 2200, { expression: 'crying' }));
        }
      } else if (this.setMood('CURIOUS', now, { expression: 'confused' })) {
        this.say('tabsMany', now, { force: true, vars: { tabs: count } });
      }
    }
  }

  tabStorm(now: number): void {
    if (!this.cool('storm', 30_000, now)) return;
    this.setMood('CHAOTIC', now, { force: true, expression: 'dizzy', loop: 'spin', fx: 'sweat' });
    this.say('tabStorm', now, { force: true });
    this.secret('tornado');
    this.delta(EFFECTS.tabStorm);
  }

  visibility(visible: boolean, now: number): void {
    if (!visible) {
      this.hiddenAt = now;
      return;
    }
    const away = this.hiddenAt ? now - this.hiddenAt : 0;
    this.hiddenAt = null;
    this.lastTick = now;
    this.lastActivity = now;
    if (away >= 20 * 60_000) {
      this.wake(now, away);
    } else if (away >= 60_000 / this.timeScale && this.cool('jealous', 5 * 60_000, now) && this.chance(0.5)) {
      this.setMood('JEALOUS', now, { force: true, oneShot: 'nod' });
      this.say('jealous', now, { force: true, vars: { mins: Math.max(1, Math.round(away / 60_000)) } });
      this.secret('jealous');
    } else if (this.snap.mood === 'SLEEPING' || this.snap.mood === 'BORED') {
      this.setMood('IDLE', now);
    }
  }

  // ------------------------------------------------------------ mini actions
  gameStart(now: number): void {
    this.setMood('EXCITED', now, { force: true, fx: null, loop: 'bob' });
    this.say('gameStart', now, { force: true });
  }

  gameResult(result: number | 'early', now: number): void {
    this.activity(now);
    if (result === 'early') {
      this.setMood('CURIOUS', now, { force: true, expression: 'suspicious', fx: 'anger' });
      this.say('gameEarly', now, { force: true });
      return;
    }
    const ms = Math.round(result);
    this.delta(EFFECTS.play);
    const best = this.ps.bestReactionMs;
    if (ms < 250) this.secret('speedrun');
    if (best === null || ms < best) {
      this.emit({ type: 'pet', patch: (p) => ({ bestReactionMs: p.bestReactionMs === null ? ms : Math.min(p.bestReactionMs, ms) }) });
    }
    if (best !== null && ms < best) {
      this.setMood('EXCITED', now, { force: true, oneShot: 'reunion', fx: 'confetti' });
      this.say('gameRecord', now, { force: true, vars: { ms } });
    } else if (ms > 650) {
      this.setMood('BORED', now, { force: true });
      this.say('gameSlow', now, { force: true, vars: { ms } });
    } else {
      this.setMood('HAPPY', now, { force: true, oneShot: 'hop' });
      this.say('gameWin', now, { force: true, vars: { ms } });
    }
  }

  randomMood(now: number): Mood {
    const options = MOODS.filter((m) => m !== 'SLEEPING' && m !== this.snap.mood);
    const mood = this.pickOne(options);
    this.say('moodDice', now, { force: true });
    this.setMood(mood, now, { force: true, oneShot: 'flip' });
    return mood;
  }

  summon(now: number): void {
    this.activity(now);
    this.setMood('HAPPY', now, { force: true, oneShot: 'reunion' });
    this.say('summon', now, { force: true });
  }

  rename(now: number): void {
    this.setMood('HAPPY', now, { force: true, oneShot: 'hop', fx: 'notes' });
    this.say('rename', now, { force: true });
  }

  minimized(now: number, min: boolean): void {
    this.say(min ? 'minimize' : 'restore', now, { force: true });
    if (!min) this.setMood('EXCITED', now, { force: true, oneShot: 'jump' });
  }

  thought(now = Date.now()): string {
    const tabsNote = this.tabLevel > 0 ? ['Still thinking about all those tabs.'] : [];
    const pool = [...(THOUGHTS[this.snap.mood] ?? THOUGHTS.IDLE), ...tabsNote];
    void now;
    return this.pickOne(pool);
  }

  // -------------------------------------------------------------------- tick
  /** Advance timers. Only called while the page is visible. */
  tick(now: number): void {
    const dt = Math.min(5000, now - this.lastTick);
    this.lastTick = now;

    const due = this.pending.filter((p) => p.at <= now);
    this.pending = this.pending.filter((p) => p.at > now);
    due.forEach((p) => p.run());

    if (this.exprOverride && now > this.exprOverride.until) {
      this.exprOverride = null;
      this.publish({ expression: this.expressionFor(this.snap.mood), arms: MOOD_CONFIG[this.snap.mood].arms });
    }
    if (this.snap.golden && now > this.goldenUntil) this.publish({ golden: false });
    if (this.snap.stare && now > this.stareUntil) this.publish({ stare: false, expression: 'neutral' });
    if (this.snap.hidden && now > this.hiddenUntil) this.publish({ hidden: null });

    // mood expiry
    const cfg = MOOD_CONFIG[this.snap.mood];
    if (cfg.maxMs !== null && now - this.moodSince > cfg.maxMs) this.setMood('IDLE', now, { force: true });

    const idle = now - this.lastActivity;
    const active = idle < 2 * 60_000;
    this.ladder(idle, now);

    // time together & session tracking
    if (active) {
      this.pendingTime += dt;
      this.sessionActive += dt;
      this.togetherAcc += dt;
    } else if (idle > 5 * 60_000) {
      this.sessionActive = 0;
    }
    if (this.pendingTime >= 15_000) {
      const add = this.pendingTime;
      this.pendingTime = 0;
      this.emit({ type: 'pet', patch: (p) => ({ totalTimeMs: p.totalTimeMs + add, lastSeen: now }) });
    }
    if (this.togetherAcc >= 30 * 60_000) {
      this.togetherAcc = 0;
      this.delta(EFFECTS.together30m);
    }
    if (!this.marathonDone && this.sessionActive >= 45 * 60_000) {
      this.marathonDone = true;
      this.setMood('EXCITED', now, { force: true, oneShot: 'reunion', fx: 'confetti' });
      this.say('marathon', now, { force: true, vars: { mins: Math.round(this.sessionActive / 60_000) } });
      this.secret('marathon');
    }
    const hoursOpen = Math.floor((now - this.pageOpened) / 3_600_000);
    if (hoursOpen > this.tabAgeAnnounced && active) {
      this.tabAgeAnnounced = hoursOpen;
      this.say('tabAge', now, { chance: 0.7, vars: { hours: hoursOpen } });
    }
    if (this.ambientOn && !this.midnightDone && new Date(now).getHours() === 0 && active && this.cool('midnightCheck', 60_000, now)) this.midnight(now);

    if (now - this.lastThoughtAt > 30_000) {
      this.lastThoughtAt = now;
      const thought = this.thought(now);
      const { mood, expression } = this.snap;
      this.emit({ type: 'pet', patch: () => ({ thought, mood, expression, recentLines: this.speaker.recentIds }) });
    }

    if (now >= this.nextAmbient) {
      this.nextAmbient = now + this.ambientDelay();
      if (this.ambientOn && active && idle < 60_000) this.ambient(now);
    }
  }

  private ladder(idle: number, now: number): void {
    const s = this.timeScale;
    const mood = this.snap.mood;
    if (!RESTING.includes(mood)) return;
    if (idle >= IDLE_STEPS.sleep / s) {
      if (mood !== 'SLEEPING') {
        this.setMood('SLEEPING', now, { force: true, oneShot: 'squish' });
        this.say('sleep', now, { chance: 0.5 });
      }
      const nextComplaint = IDLE_STEPS.complain[this.complaintsDone];
      if (nextComplaint !== undefined && idle >= nextComplaint / s) {
        this.complaintsDone++;
        this.setMood('DRAMATIC', now, { force: true, expression: 'crying' });
        this.say('sleeptalk', now, { force: true, vars: { mins: Math.round(idle / 60_000) } });
      }
    } else if (idle >= IDLE_STEPS.yawn / s) {
      if (mood !== 'BORED') {
        this.setMood('BORED', now, { force: true, expression: 'sleepy', oneShot: 'yawn' });
        this.say('yawn', now, { chance: 0.6 });
      }
    } else if (idle >= IDLE_STEPS.look / s && mood === 'IDLE' && !this.snap.lookAround) {
      this.publish({ lookAround: true });
      this.say('idleLook', now, { chance: 0.25 });
    }
  }

  /** Random unprompted behaviour. Rare things are rare on purpose. */
  private ambient(now: number): void {
    const mood = this.snap.mood;
    if (!['IDLE', 'HAPPY', 'BORED', 'CURIOUS', 'AFFECTIONATE'].includes(mood)) return;
    const t = this.tier;
    const chaos = this.ps.chaos;
    const table: [number, () => void][] = [
      [34, () => this.say('ambient', now)],
      [12, () => this.oneShot('hop')],
      [14, () => this.publish({ lookAround: true })],
      [this.wander ? 14 : 0, () => this.emit({ type: 'wander' })],
      [t >= 2 || mood === 'HAPPY' ? 6 : 1.5, () => this.dance(now)],
      [2.5, () => this.stare(now)],
      [1, () => this.golden(now)],
      [1.5 + chaos / 40, () => this.teleport(now)],
      [1.6, () => this.say('unexpected', now, { force: true })],
      [5, () => this.override('innocent', 3000, now, 'hold')],
      [chaos > 40 ? 4 : 1, () => this.override('evil', 2500, now, 'hold')],
      [t >= 2 ? 5 : 0, () => this.setMood('AFFECTIONATE', now, { oneShot: 'nod' })],
    ];
    const total = table.reduce((s, [w]) => s + w, 0);
    let roll = this.rng() * total;
    for (const [w, fn] of table) {
      roll -= w;
      if (roll <= 0) {
        fn();
        return;
      }
    }
  }

  dance(now: number): void {
    this.setMood('HAPPY', now, { force: true, expression: 'happy', oneShot: 'dance', fx: 'notes', arms: 'wave' });
    this.say('dance', now, { chance: 0.7 });
    this.secret('dance');
  }

  stare(now: number): void {
    this.stareUntil = now + 4200;
    this.setMood('IDLE', now, { force: true, expression: 'stare' });
    this.publish({ stare: true });
    this.say('stare', now, { force: true, chance: 0.7 });
    this.secret('stare');
  }

  teleport(now: number): void {
    this.hiddenUntil = now + 900;
    this.publish({ hidden: 'glitch' });
    this.emit({ type: 'sound', name: 'zap' });
    this.emit({ type: 'teleport' });
    this.secret('teleport');
    this.later(950, now, () => this.say('teleport', now + 950, { chance: 0.6 }));
  }
}
