import { LINES, type DialogueEvent, type Line, type Rarity, type Tier } from './dialogue';
import type { Mood } from './moods';

const RARITY_WEIGHT: Record<Rarity, number> = { c: 10, u: 4, r: 1.2, l: 0.35 };

export interface SpeechContext {
  mood: Mood;
  tier: Tier;
  vars?: Record<string, string | number>;
}

/**
 * Picks lines with weighted randomness while avoiding repetition.
 * - Every line remembers when it was last said and has its own cooldown.
 * - The last N line ids are excluded outright (and persisted across pages).
 */
export class Speaker {
  private lastSaid = new Map<string, number>();
  private recent: string[];
  private readonly byEvent = new Map<DialogueEvent, Line[]>();

  constructor(
    recent: string[] = [],
    private rng: () => number = Math.random,
    private lineCooldownMs = 10 * 60_000,
    private recentSize = 40,
  ) {
    this.recent = recent.slice(-recentSize);
    for (const l of LINES) {
      const list = this.byEvent.get(l.event) ?? [];
      list.push(l);
      this.byEvent.set(l.event, list);
    }
  }

  get recentIds(): string[] {
    return [...this.recent];
  }

  pick(event: DialogueEvent, ctx: SpeechContext, now = Date.now()): Line | null {
    const pool = (this.byEvent.get(event) ?? []).filter(
      (l) => ctx.tier >= l.min && ctx.tier <= l.max && (!l.mood || l.mood.includes(ctx.mood)),
    );
    if (!pool.length) return null;
    let candidates = pool.filter((l) => !this.recent.includes(l.id) && now - (this.lastSaid.get(l.id) ?? -Infinity) > this.lineCooldownMs);
    // If every line is cooling down, fall back to the least-recently-said one.
    if (!candidates.length) {
      candidates = [...pool].sort((a, b) => (this.lastSaid.get(a.id) ?? 0) - (this.lastSaid.get(b.id) ?? 0)).slice(0, 1);
    }
    const total = candidates.reduce((s, l) => s + RARITY_WEIGHT[l.r], 0);
    let roll = this.rng() * total;
    let chosen = candidates[candidates.length - 1];
    for (const l of candidates) {
      roll -= RARITY_WEIGHT[l.r];
      if (roll <= 0) {
        chosen = l;
        break;
      }
    }
    this.lastSaid.set(chosen.id, now);
    this.recent = [...this.recent.filter((id) => id !== chosen.id), chosen.id].slice(-this.recentSize);
    return chosen;
  }

  static format(text: string, vars: Record<string, string | number> = {}): string {
    return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
  }
}
