/**
 * Unit tests for the behaviour engine, dialogue system and relationship maths.
 * Run with: npm test
 */
import assert from 'node:assert/strict';
import { Brain, IDLE_STEPS, type Output } from '../src/engine/brain';
import { LINES } from '../src/engine/dialogue';
import { MOODS } from '../src/engine/moods';
import { applyDelta, EFFECTS, onNewSession, tierOf } from '../src/engine/relationship';
import { SECRETS } from '../src/engine/secrets';
import { Speaker } from '../src/engine/speech';
import { defaultPet } from '../src/shared/types';
import { CORE_EXPRESSIONS, EXPRESSIONS, renderSprite } from '../src/sprite/sprite';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

/** Deterministic RNG */
function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function makeBrain(opts: { trust?: number; affection?: number; rng?: () => number } = {}) {
  const pet = { ...defaultPet(0), trust: opts.trust ?? 5, affection: opts.affection ?? 20 };
  // ambient: false keeps the tests independent of the wall clock (e.g. the midnight surprise)
  const brain = new Brain({ pet, intensity: 'normal', rng: opts.rng ?? seeded(), now: 0, ambient: false });
  const outputs: Output[] = [];
  brain.onOutput((o) => outputs.push(o));
  return { brain, outputs };
}

console.log('dialogue');
test('has at least 150 original lines', () => assert.ok(LINES.length >= 150, `only ${LINES.length}`));
test('line ids are unique', () => assert.equal(new Set(LINES.map((l) => l.id)).size, LINES.length));
test('has rare and legendary lines', () => {
  assert.ok(LINES.some((l) => l.r === 'r'));
  assert.ok(LINES.filter((l) => l.r === 'l').length >= 5);
});
test('lines are organised by relationship tier', () => {
  assert.ok(LINES.some((l) => l.max === 0));
  assert.ok(LINES.some((l) => l.min === 3));
});
test('speaker never repeats a line back-to-back', () => {
  const sp = new Speaker([], seeded(1));
  let prev = '';
  for (let i = 0; i < 60; i++) {
    const l = sp.pick('poke', { mood: 'IDLE', tier: 1 }, i * 1000)!;
    assert.notEqual(l.id, prev);
    prev = l.id;
  }
});
test('speaker respects relationship tiers', () => {
  const sp = new Speaker([], seeded(2));
  for (let i = 0; i < 40; i++) {
    const l = sp.pick('greet', { mood: 'IDLE', tier: 0 }, i * 1e9)!;
    assert.ok(l.min === 0, `stranger got tiered line ${l.id}`);
  }
});
test('placeholders are filled', () => assert.equal(Speaker.format('{tabs} tabs', { tabs: 12 }), '12 tabs'));

console.log('sprites');
test('15 core expressions all render distinct SVGs', () => {
  assert.equal(CORE_EXPRESSIONS.length, 15);
  const svgs = new Set(CORE_EXPRESSIONS.map((e) => renderSprite({ expression: e })));
  assert.equal(svgs.size, 15);
});
test('every expression renders', () => EXPRESSIONS.forEach((e) => assert.ok(renderSprite({ expression: e }).startsWith('<svg'))));
test('eyes follow the cursor (look changes pixels)', () => {
  assert.notEqual(renderSprite({ expression: 'neutral', lookX: -1 }), renderSprite({ expression: 'neutral', lookX: 1 }));
});

console.log('state machine');
test('declares all 12 moods', () => assert.equal(MOODS.length, 12));
test('inactivity ladder: look around → yawn → sleep → complain', () => {
  const { brain, outputs } = makeBrain();
  const t = (ms: number) => brain.tick(ms);
  t(IDLE_STEPS.look + 100);
  assert.equal(brain.snapshot.lookAround, true);
  t(IDLE_STEPS.yawn + 100);
  assert.equal(brain.snapshot.mood, 'BORED');
  assert.equal(brain.snapshot.oneShot?.name, 'yawn');
  t(IDLE_STEPS.sleep + 100);
  assert.equal(brain.snapshot.mood, 'SLEEPING');
  t(IDLE_STEPS.complain[0] + 100);
  assert.equal(brain.snapshot.mood, 'DRAMATIC');
  assert.ok(outputs.some((o) => o.type === 'say'));
});
test('returning after sleep wakes it up', () => {
  const { brain } = makeBrain();
  brain.tick(IDLE_STEPS.sleep + 100);
  assert.equal(brain.snapshot.mood, 'SLEEPING');
  brain.activity(IDLE_STEPS.sleep + 5000);
  assert.notEqual(brain.snapshot.mood, 'SLEEPING');
});
test('priority: a low-priority mood cannot interrupt SHOCKED immediately', () => {
  const { brain } = makeBrain();
  assert.ok(brain.setMood('SHOCKED', 1000));
  assert.equal(brain.setMood('HAPPY', 1100), false);
  assert.equal(brain.snapshot.mood, 'SHOCKED');
  assert.ok(brain.setMood('HAPPY', 4000));
});
test('moods relax back to IDLE after their max duration', () => {
  const { brain } = makeBrain();
  brain.setMood('EXCITED', 1000, { force: true });
  brain.activity(7000);
  brain.tick(7500);
  assert.equal(brain.snapshot.mood, 'IDLE');
});
test('poke spam makes it angry, then it teleports away', () => {
  const { brain, outputs } = makeBrain();
  for (let i = 0; i < 6; i++) brain.poke(1000 + i * 200);
  assert.equal(brain.snapshot.mood, 'ANGRY');
  for (let i = 0; i < 8; i++) brain.poke(2500 + i * 150);
  brain.tick(6000);
  assert.ok(outputs.some((o) => o.type === 'secret' && o.id === 'manager'));
  assert.ok(outputs.some((o) => o.type === 'teleport'));
});
test('secret handshake: poke, poke, pet, poke', () => {
  const { brain, outputs } = makeBrain();
  brain.poke(1000);
  brain.poke(1600);
  brain.pet(2200);
  brain.poke(2800);
  assert.ok(outputs.some((o) => o.type === 'secret' && o.id === 'handshake'));
});
test('many tabs → confused, way too many → panic', () => {
  const { brain } = makeBrain();
  brain.tabs(12, 1000);
  assert.equal(brain.snapshot.mood, 'CURIOUS');
  assert.equal(brain.snapshot.expression, 'confused');
  brain.tabs(24, 9000);
  assert.equal(brain.snapshot.mood, 'SHOCKED');
});
test('tab tornado → dizzy', () => {
  const { brain, outputs } = makeBrain();
  brain.tabStorm(1000);
  assert.equal(brain.snapshot.expression, 'dizzy');
  assert.ok(outputs.some((o) => o.type === 'secret' && o.id === 'tornado'));
});
test('page clicks do not trigger a reaction every time', () => {
  const { brain, outputs } = makeBrain();
  for (let i = 0; i < 50; i++) brain.pageClick(1000 + i * 4000);
  const said = outputs.filter((o) => o.type === 'say').length;
  assert.ok(said < 15, `spoke ${said} times for 50 clicks`);
});
test('overfeeding is noticed', () => {
  const { brain, outputs } = makeBrain();
  for (let i = 0; i < 7; i++) brain.feed('cookie', 1000 + i * 3000);
  assert.ok(outputs.some((o) => o.type === 'secret' && o.id === 'balloon'));
});
test('pet makes it affectionate once trusted', () => {
  const { brain } = makeBrain({ trust: 50, affection: 60 });
  brain.pet(1000);
  assert.equal(brain.snapshot.mood, 'AFFECTIONATE');
});

console.log('relationship');
test('tiers progress with trust', () => {
  assert.equal(tierOf({ trust: 0, affection: 0 }), 0);
  assert.equal(tierOf({ trust: 20, affection: 0 }), 1);
  assert.equal(tierOf({ trust: 50, affection: 0 }), 2);
  assert.equal(tierOf({ trust: 80, affection: 80 }), 3);
});
test('interactions raise scores and are clamped', () => {
  let p = defaultPet(0);
  for (let i = 0; i < 200; i++) p = { ...p, ...applyDelta(p, EFFECTS.pet) };
  assert.equal(p.affection, 100);
  assert.equal(p.trust, 100);
  assert.equal(p.favorites.pet, 200);
});
test('neglect for days creates a grudge', () => {
  const p = { ...defaultPet(0), lastSeen: 1 };
  const { patch, awayDays } = onNewSession(p, 5 * 86_400_000 + 1);
  assert.equal(awayDays, 5);
  assert.equal(patch.grudge, 3);
  assert.ok((patch.affection ?? 100) < p.affection);
});
test('a neglected gremlin forgives after a few pets', () => {
  const pet = { ...defaultPet(0), trust: 30, grudge: 3 };
  const brain = new Brain({ pet, intensity: 'normal', rng: seeded(), now: 0, ambient: false });
  const said: string[] = [];
  brain.onOutput((o) => o.type === 'say' && said.push(o.id));
  brain.pet(1000);
  brain.pet(4000);
  brain.pet(7000);
  assert.ok(said.some((id) => id.startsWith('forgive')));
});
test('first ever meeting is not treated as neglect', () => {
  const { patch, awayDays } = onNewSession(defaultPet(0), 9 * 86_400_000);
  assert.equal(awayDays, 0);
  assert.equal(patch.grudge, undefined);
});
test('at least 12 secrets exist', () => assert.ok(SECRETS.length >= 12));

console.log(`\n${passed} tests passed`);
