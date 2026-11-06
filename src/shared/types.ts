import type { Expression } from '../sprite/sprite';

export type Intensity = 'chill' | 'normal' | 'unhinged';
export type AnimLevel = 'low' | 'normal' | 'extra';
export type TriState = 'auto' | 'on' | 'off';
export type Theme = 'auto' | 'light' | 'dark';
export type Size = 'small' | 'medium' | 'large';

export interface Settings {
  /** Master visibility toggle. */
  visible: boolean;
  /** Tiny synthesised sound effects. Off by default — websites are loud enough. */
  sound: boolean;
  /** Speech bubbles. When off the Gremlin still emotes, just silently. */
  bubbles: boolean;
  intensity: Intensity;
  animation: AnimLevel;
  reducedMotion: TriState;
  theme: Theme;
  size: Size;
  /** Lets the Gremlin shuffle around a little on its own. */
  wander: boolean;
  name: string;
  /** Hostnames where the user hid the Gremlin. Only ever set by the user. */
  hiddenSites: string[];
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  visible: true,
  sound: false,
  bubbles: true,
  intensity: 'normal',
  animation: 'normal',
  reducedMotion: 'auto',
  theme: 'auto',
  size: 'small',
  wander: true,
  name: 'Gorp',
  hiddenSites: [],
  onboarded: false,
};

export type Favorite = 'pet' | 'feed' | 'poke' | 'play' | 'drag';

export interface PetState {
  createdAt: number;
  lastSeen: number;
  visits: number;
  interactions: number;
  totalTimeMs: number;
  affection: number;
  trust: number;
  chaos: number;
  favorites: Record<Favorite, number>;
  secrets: string[];
  goldenSightings: number;
  bestReactionMs: number | null;
  snacksEaten: number;
  /** Ids of recently spoken lines, so they are not repeated too often. */
  recentLines: string[];
  /** Set when the Gremlin was neglected for days; cleared when it forgives. */
  grudge: number;
  mood: string;
  expression: Expression;
  thought: string;
  /** Expressions the owner has witnessed (for the gallery). */
  seen: Expression[];
  /** Last “days together” milestone that was celebrated. */
  lastMilestone: number;
}

export function defaultPet(now = Date.now()): PetState {
  return {
    createdAt: now,
    /** 0 = never met (first ever page visit). */
    lastSeen: 0,
    visits: 1,
    interactions: 0,
    totalTimeMs: 0,
    affection: 20,
    trust: 5,
    chaos: 10,
    favorites: { pet: 0, feed: 0, poke: 0, play: 0, drag: 0 },
    secrets: [],
    goldenSightings: 0,
    bestReactionMs: null,
    snacksEaten: 0,
    recentLines: [],
    grudge: 0,
    mood: 'IDLE',
    expression: 'neutral',
    thought: 'Who is this large creature with the mouse?',
    seen: ['neutral'],
    lastMilestone: 0,
  };
}

export interface Position {
  /** Left edge of the Gremlin as a fraction of viewport width. */
  x: number;
  /** Top edge of the Gremlin as a fraction of viewport height. */
  y: number;
  minimized: boolean;
}

export const DEFAULT_POSITION: Position = { x: 0.94, y: 0.7, minimized: false };

export interface StoredData {
  settings: Settings;
  pet: PetState;
  position: Position;
}

export type MenuAction = 'pet' | 'feed' | 'play' | 'mood' | 'thoughts' | 'summon';

/** Messages sent from the background worker or popup to a tab. */
export type TabMessage =
  | { type: 'tabs'; count: number }
  | { type: 'tabStorm' }
  | { type: 'action'; action: MenuAction }
  | { type: 'ping' };

/** Messages sent from content scripts / pages to the background worker. */
export type WorkerMessage = { type: 'openOptions' } | { type: 'getTabCount' };
