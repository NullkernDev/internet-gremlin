import type { Arms, Expression } from '../sprite/sprite';

export const MOODS = [
  'IDLE',
  'HAPPY',
  'BORED',
  'SLEEPING',
  'ANGRY',
  'EXCITED',
  'JEALOUS',
  'CURIOUS',
  'SHOCKED',
  'DRAMATIC',
  'AFFECTIONATE',
  'CHAOTIC',
] as const;
export type Mood = (typeof MOODS)[number];

/** Looping body animation for a mood (CSS class suffix). */
export type LoopAnim =
  | 'breathe'
  | 'bob'
  | 'sway'
  | 'snooze'
  | 'fume'
  | 'bounce'
  | 'lean'
  | 'tilt'
  | 'tremble'
  | 'sob'
  | 'float'
  | 'wiggle'
  | 'spin';

/** One-shot animations layered on top of the loop. */
export type OneShot =
  | 'jump'
  | 'hop'
  | 'flip'
  | 'shake'
  | 'dance'
  | 'yawn'
  | 'chomp'
  | 'land'
  | 'nod'
  | 'squish'
  | 'reunion'
  | 'peek';

export type Fx = 'zzz' | 'hearts' | 'question' | 'exclaim' | 'sparkle' | 'confetti' | 'anger' | 'notes' | 'sweat' | 'crumbs' | 'tears';

export interface MoodConfig {
  /** Higher priority moods can't be interrupted by lower ones until minMs elapses. */
  priority: number;
  minMs: number;
  /** After this long the mood relaxes back to IDLE (unless it is a resting mood). */
  maxMs: number | null;
  expressions: Expression[];
  loop: LoopAnim;
  fx?: Fx;
  arms?: Arms;
}

export const MOOD_CONFIG: Record<Mood, MoodConfig> = {
  IDLE: { priority: 0, minMs: 0, maxMs: null, expressions: ['neutral'], loop: 'breathe' },
  HAPPY: { priority: 2, minMs: 2500, maxMs: 9000, expressions: ['happy', 'happy', 'proud'], loop: 'bob' },
  BORED: { priority: 1, minMs: 2000, maxMs: null, expressions: ['bored', 'sleepy'], loop: 'sway' },
  SLEEPING: { priority: 1, minMs: 3000, maxMs: null, expressions: ['sleeping'], loop: 'snooze', fx: 'zzz' },
  ANGRY: { priority: 4, minMs: 3000, maxMs: 8000, expressions: ['angry'], loop: 'fume', fx: 'anger' },
  EXCITED: { priority: 3, minMs: 2000, maxMs: 6000, expressions: ['excited'], loop: 'bounce', fx: 'sparkle' },
  JEALOUS: { priority: 3, minMs: 3500, maxMs: 9000, expressions: ['suspicious', 'sad'], loop: 'lean' },
  CURIOUS: { priority: 2, minMs: 2000, maxMs: 7000, expressions: ['confused', 'suspicious', 'neutral'], loop: 'tilt', fx: 'question' },
  SHOCKED: { priority: 5, minMs: 1500, maxMs: 3500, expressions: ['shocked'], loop: 'tremble', fx: 'exclaim' },
  DRAMATIC: { priority: 4, minMs: 3500, maxMs: 9000, expressions: ['crying', 'sad', 'exhausted'], loop: 'sob', fx: 'tears' },
  AFFECTIONATE: { priority: 3, minMs: 3000, maxMs: 8000, expressions: ['love', 'happy'], loop: 'float', fx: 'hearts' },
  CHAOTIC: { priority: 4, minMs: 2500, maxMs: 7000, expressions: ['evil', 'dizzy', 'excited'], loop: 'wiggle' },
};

export const MOOD_LABEL: Record<Mood, string> = {
  IDLE: 'Chilling',
  HAPPY: 'Happy',
  BORED: 'Bored',
  SLEEPING: 'Asleep',
  ANGRY: 'Furious',
  EXCITED: 'Hyped',
  JEALOUS: 'Jealous',
  CURIOUS: 'Curious',
  SHOCKED: 'Shook',
  DRAMATIC: 'Dramatic',
  AFFECTIONATE: 'Smitten',
  CHAOTIC: 'Chaotic',
};
