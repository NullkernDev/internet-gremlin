import type { Favorite, PetState } from '../shared/types';
import type { Tier } from './dialogue';

export const TIER_NAMES = ['Stranger', 'Acquaintance', 'Friend', 'Bestie'] as const;
export const TIER_BLURB = [
  'Shy and suspicious. Earn its trust with pets and snacks.',
  'It tolerates you. It might even like you. Don’t push it.',
  'Expressive, chatty, and quietly devoted.',
  'Bonded for life. Unlocks tiny dances and special greetings.',
];

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function tierOf(p: Pick<PetState, 'trust' | 'affection'>): Tier {
  if (p.trust >= 70 && p.affection >= 55) return 3;
  if (p.trust >= 38) return 2;
  if (p.trust >= 14) return 1;
  return 0;
}

export function favoriteOf(p: PetState): Favorite | null {
  const entries = Object.entries(p.favorites) as [Favorite, number][];
  const top = entries.sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > 0 ? top[0] : null;
}

export const FAVORITE_LABEL: Record<Favorite, string> = {
  pet: 'Getting pets',
  feed: 'Snack time',
  poke: 'Being poked (allegedly hates it)',
  play: 'The reaction game',
  drag: 'Being carried around',
};

export interface Delta {
  affection?: number;
  trust?: number;
  chaos?: number;
  favorite?: Favorite;
  interaction?: boolean;
}

/** Interaction effects. Kept small so the relationship grows over days, not minutes. */
export const EFFECTS = {
  pet: { affection: 2.2, trust: 1.1, chaos: -1, favorite: 'pet', interaction: true },
  feed: { affection: 1.6, trust: 0.9, favorite: 'feed', interaction: true },
  play: { affection: 1.4, trust: 0.8, chaos: 1, favorite: 'play', interaction: true },
  poke: { affection: 0.15, trust: 0.25, chaos: 0.6, favorite: 'poke', interaction: true },
  pokeSpam: { affection: -1.5, trust: -0.6, chaos: 3 },
  drag: { trust: 0.3, chaos: 0.4, favorite: 'drag', interaction: true },
  shake: { affection: -1, chaos: 4 },
  tabStorm: { chaos: 3 },
  together30m: { affection: 1, trust: 1.5, chaos: -2 },
  visit: { trust: 0.6, affection: 0.4 },
} satisfies Record<string, Delta>;

export function applyDelta(p: PetState, d: Delta): Partial<PetState> {
  // trust is hard to win and slow to lose; strangers warm up a little faster
  const trustGain = (d.trust ?? 0) * (p.trust < 14 ? 1.4 : 1);
  const out: Partial<PetState> = {
    affection: clamp(p.affection + (d.affection ?? 0)),
    trust: clamp(p.trust + trustGain),
    chaos: clamp(p.chaos + (d.chaos ?? 0)),
  };
  if (d.interaction) out.interactions = p.interactions + 1;
  if (d.favorite) out.favorites = { ...p.favorites, [d.favorite]: p.favorites[d.favorite] + 1 };
  return out;
}

const DAY = 86_400_000;

/**
 * Called when a new browsing session starts. Handles visits, neglect and the
 * slow decay of affection/chaos while the owner was away.
 */
export function onNewSession(p: PetState, now: number): { patch: Partial<PetState>; awayDays: number } {
  const firstMeeting = p.lastSeen === 0;
  const away = firstMeeting ? 0 : now - p.lastSeen;
  const awayDays = Math.floor(away / DAY);
  if (firstMeeting) return { patch: { lastSeen: now, createdAt: now }, awayDays: 0 };
  const patch: Partial<PetState> = { visits: p.visits + 1, lastSeen: now, ...applyDelta(p, EFFECTS.visit) };
  if (awayDays >= 3) {
    patch.affection = clamp((patch.affection ?? p.affection) - Math.min(25, (awayDays - 2) * 4), 8);
    patch.grudge = 3; // three nice interactions to be forgiven
  }
  // chaos calms down while you’re away (≈ 6 points per hour)
  patch.chaos = clamp((patch.chaos ?? p.chaos) - Math.min(40, (away / 3_600_000) * 6), 5);
  return { patch, awayDays };
}

export function daysTogether(p: PetState, now = Date.now()): number {
  return Math.max(1, Math.floor((now - p.createdAt) / DAY) + 1);
}

export function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}
