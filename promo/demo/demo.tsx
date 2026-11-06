/**
 * Promo demo: the REAL in-page Gremlin (same React component, same brain,
 * same CSS) running inside a mock browser window. A scripted "director"
 * moves a fake cursor and dispatches genuine DOM events / engine events.
 *
 * Honest differences from normal use (also stated in the README):
 *  - the inactivity timers run 24× faster so dozing off fits in 5 seconds;
 *  - random ambient behaviour is switched off so the story stays on script;
 *  - the "tab count" messages come from the director instead of the
 *    background service worker.
 */
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { GremlinApp } from '../../src/content/GremlinApp';
import { demoBridge } from '../../src/content/bridge';
import contentCss from '../../src/content/content.css?inline';
import type { Brain } from '../../src/engine/brain';
import { MemoryStore } from '../../src/shared/storage';
import { defaultPet, DEFAULT_SETTINGS } from '../../src/shared/types';
import { renderSprite } from '../../src/sprite/sprite';
import './demo.css';

// ---------------------------------------------------------------- rng
let seed = Number(new URLSearchParams(location.search).get('seed') ?? 11);
const forced: number[] = [];
const rng = () => {
  if (forced.length) return forced.shift()!;
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// ---------------------------------------------------------------- world
const now = Date.now();
const store = new MemoryStore({
  settings: { ...DEFAULT_SETTINGS, name: 'Gorp', size: 'large', intensity: 'unhinged', wander: false, onboarded: true, theme: 'light', reducedMotion: 'off' },
  pet: { ...defaultPet(now - 20 * 86_400_000), lastSeen: now, trust: 46, affection: 62, chaos: 20, visits: 31 },
  position: { x: 0.77, y: 0.56, minimized: false },
});
const bridge = demoBridge();
let brain: Brain | null = null;

const TAB_NAMES = [
  'The Daily Byte',
  'Inbox (3)',
  'Recipe: 4-hour bread',
  'How to focus better',
  'Cat sits in box',
  'Flights to anywhere',
  'Docs — Q3 plan',
  'Why is my fan loud',
  'Wikipedia: Tabs',
  '10 productivity tips',
  'Shopping cart',
  'Video: 3 hrs of rain',
  'Forum thread p.47',
  'Lyrics?? that song',
  'Weather',
  'Maps',
  'Another recipe',
  'Bank (logged out)',
  'News again',
  'Unread article',
  'Tab I forgot',
  'Settings',
  'Calendar',
  'More cats',
];

function Browser({ tabs, open }: { tabs: number; open: boolean }) {
  const shown = TAB_NAMES.slice(0, tabs);
  return (
    <div className={`browser ${open ? 'open' : ''}`}>
      <div className="tabstrip">
        <div className="lights">
          <i />
          <i />
          <i />
        </div>
        <div className={`tabs ${tabs > 8 ? 'squeezed' : ''} ${tabs > 16 ? 'crushed' : ''}`}>
          {shown.map((t, i) => (
            <div key={t} className={`tab ${i === 0 ? 'active' : ''}`} style={{ ['--h' as string]: `${(i * 47) % 360}` }}>
              <span className="fav" />
              <span className="tab-title">{t}</span>
            </div>
          ))}
          <div className="tab-plus">+</div>
        </div>
        <div className="tabcount">{tabs > 6 ? `${tabs} tabs` : ''}</div>
      </div>
      <div className="toolbar">
        <span className="nav">‹ ›</span>
        <div className="url">
          <span className="lock" /> dailybyte.example/investigations/tabs
        </div>
        <span className="ext" dangerouslySetInnerHTML={{ __html: renderSprite({ expression: 'neutral' }, 0.6) }} />
      </div>
      <div className="page">
        <header>
          <h1>The Daily Byte</h1>
          <nav>
            <a id="l1">World Wide Web</a>
            <a id="l2">Tabs</a>
            <a id="l3">Cookies</a>
            <a id="l4">Opinion</a>
          </nav>
        </header>
        <main>
          <article>
            <div className="kicker">Investigation</div>
            <h2>Local Browser Reports 47 Open Tabs, “Totally Under Control”</h2>
            <div className="byline">By A. Reporter · 6 min read</div>
            <div className="figure" id="fig">
              Illustration: a very full tab bar
            </div>
            <p>Sources close to the browser confirm that at least a dozen of the tabs have not been looked at since spring.</p>
            <p>Meanwhile, a small purple creature has reportedly been seen in the corner of several screens.</p>
          </article>
          <aside>
            <section>
              <h3>Most read</h3>
              <p id="mr">Why does every website want me to accept cookies?</p>
            </section>
            <section>
              <h3>Newsletter</h3>
              <div className="fake-input">you@example.com</div>
              <div className="fake-btn" id="sub">
                Subscribe
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cursor
const cursor = { x: 640, y: 760 };
let cursorEl: HTMLDivElement | null = null;
const CURSOR_SVG = (() => {
  const rows = ['K..........', 'KK.........', 'KWK........', 'KWWK.......', 'KWWWK......', 'KWWWWK.....', 'KWWWWWK....', 'KWWWWWWK...', 'KWWWWWWWK..', 'KWWWWWKKKK.', 'KWWKWWK....', 'KWK.KWWK...', 'KK..KWWK...', 'K....KWWK..', '.....KWWK..', '......KK...'];
  let d = '';
  let w = '';
  rows.forEach((r, y) => [...r].forEach((c, x) => (c === 'K' ? (d += `M${x} ${y}h1v1h-1z`) : c === 'W' ? (w += `M${x} ${y}h1v1h-1z`) : null)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 16" width="22" height="32" shape-rendering="crispEdges"><path fill="#1c1230" d="${d}"/><path fill="#fff" d="${w}"/></svg>`;
})();

function fire(type: string, x: number, y: number, target: EventTarget = window, buttons = 0) {
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons }));
}

function placeCursor() {
  if (cursorEl) cursorEl.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
}

function moveTo(x: number, y: number, ms: number, target?: () => EventTarget | null): Promise<void> {
  const sx = cursor.x;
  const sy = cursor.y;
  const t0 = performance.now();
  return new Promise((done) => {
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      cursor.x = sx + (x - sx) * e;
      cursor.y = sy + (y - sy) * e;
      placeCursor();
      fire('pointermove', cursor.x, cursor.y, target?.() ?? window);
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

// ---------------------------------------------------------------- event log
// Every story beat and every reaction of the real engine is time-stamped, so
// scripts/soundtrack.ts can sync the sound effects to the picture.
let T0 = 0;
const events: { t: number; type: string; name: string }[] = [];
function log(type: string, name = '') {
  if (T0) events.push({ t: Math.round(performance.now() - T0) / 1000, type, name });
}
(window as unknown as { __events: typeof events }).__events = events;

function ripple() {
  const r = document.createElement('div');
  r.className = 'ripple';
  r.style.left = `${cursor.x}px`;
  r.style.top = `${cursor.y}px`;
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 600);
  cursorEl?.classList.add('press');
  setTimeout(() => cursorEl?.classList.remove('press'), 120);
}

function pageClick() {
  log('click');
  ripple();
  fire('pointerdown', cursor.x, cursor.y);
  fire('pointerup', cursor.x, cursor.y);
}

function spriteEl(): HTMLElement | null {
  return document.querySelector('#gremlin-host')?.shadowRoot?.querySelector('.ig-sprite') ?? null;
}
function spriteCenter() {
  const r = spriteEl()!.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height * 0.55, w: r.width };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const center = (id: string) => {
  const r = document.getElementById(id)!.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

// ---------------------------------------------------------------- app
function Demo() {
  const [open, setOpen] = useState(false);
  const [tabs, setTabs] = useState(3);
  const [caption, setCaption] = useState<{ n: string; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [end, setEnd] = useState(false);

  useEffect(() => {
    (window as unknown as { __startDemo: () => Promise<void> }).__startDemo = async () => {
      T0 = performance.now();
      const at = (s: number) => wait(Math.max(0, T0 + s * 1000 - performance.now()));
      const say = (n: string, text: string) => {
        log('scene', n);
        setCaption({ n, text });
      };
      log('open');

      // Scene 1 — a browser opens, a tiny Gremlin appears in the corner
      setOpen(true);
      await at(0.8);
      say('01', 'A tiny creature moves into your browser.');
      setMounted(true);
      log('appear');
      await at(1.7);
      brain?.setMood('HAPPY', Date.now(), { force: true, oneShot: 'reunion', fx: 'sparkle' });
      brain?.say('greet', Date.now(), { force: true });

      // Scene 2 — the user clicks around, the Gremlin gets excited and jumps
      await at(3.6);
      say('02', 'Click around — it gets excited.');
      const links = ['l1', 'l2', 'l3', 'mr', 'sub', 'fig', 'l4'];
      await moveTo(center('l1').x, center('l1').y, 500);
      for (const id of links) {
        const c = center(id);
        await moveTo(c.x, c.y, 200);
        pageClick();
        await wait(90);
      }

      // Scene 3 — inactivity: look around, yawn, fall asleep
      await at(8.7);
      say('03', 'Go idle — it yawns, then dozes off.');
      await moveTo(330, 470, 600);
      brain?.setMood('IDLE', Date.now(), { force: true });
      brain?.activity(Date.now());

      // Scene 4 — the user returns: dramatic, grumpy wake-up
      await at(15.0);
      say('04', 'Come back — it wakes up. Grumpy.');
      forced.push(0.35); // pick the grumpy branch of the (normally random) wake-up
      await moveTo(760, 380, 700);

      // Scene 5 — far too many tabs: panic
      await at(18.8);
      say('05', 'Open way too many tabs — it panics.');
      for (let n = 4; n <= 12; n++) {
        log('tab', String(n));
        setTabs(n);
        await wait(70);
      }
      await at(19.9);
      bridge.send({ type: 'tabs', count: 12 });
      void moveTo(cursor.x + 30, cursor.y + 10, 500);
      await at(20.6);
      for (let n = 13; n <= 24; n++) {
        log('tab', String(n));
        setTabs(n);
        await wait(60);
      }
      bridge.send({ type: 'tabs', count: 24 });
      await wait(400);
      await moveTo(cursor.x - 40, cursor.y + 30, 900);
      await moveTo(cursor.x + 20, cursor.y - 10, 700);

      // Scene 6 — petting makes it happy
      await at(23.6);
      say('06', 'Pet it — instant love.');
      setTabs(3);
      bridge.send({ type: 'tabs', count: 3 });
      const sc = spriteCenter();
      await moveTo(sc.x - sc.w * 0.3, sc.y, 650);
      for (let i = 0; i < 4; i++) {
        await moveTo(sc.x + sc.w * 0.3, sc.y, 150, spriteEl);
        await moveTo(sc.x - sc.w * 0.3, sc.y, 150, spriteEl);
      }
      await moveTo(sc.x - sc.w * 0.9, sc.y + 40, 400);

      // Final — logo and tagline
      await at(27.0);
      setCaption(null);
      log('end');
      setEnd(true);
      await at(30.2);
      document.body.dataset.done = '1';
    };
    document.body.dataset.ready = '1';
  }, []);

  return (
    <>
      <div className="sky" />
      <Browser tabs={tabs} open={open} />
      {caption && (
        <div className="caption" key={caption.n}>
          <span className="cap-n">{caption.n}</span>
          {caption.text}
        </div>
      )}
      {mounted && !end && <GremlinMount />}
      <div className="cursor" ref={(el) => void ((cursorEl = el), placeCursor())} dangerouslySetInnerHTML={{ __html: CURSOR_SVG }} />
      {end && <EndCard />}
    </>
  );
}

function GremlinMount() {
  useEffect(() => {
    const host = document.createElement('div');
    host.id = 'gremlin-host';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = contentCss;
    shadow.appendChild(style);
    const container = document.createElement('div');
    shadow.appendChild(container);
    document.body.appendChild(host);
    const root = createRoot(container);
    root.render(
      <GremlinApp
        store={store}
        bridge={bridge}
        hostEl={host}
        timeScale={24}
        rng={rng}
        ambient={false}
        onBrain={(b) => {
          brain = b;
          let lastShot = 0;
          let lastMood = '';
          let lastFx = 0;
          b.onOutput((o) => {
            if (o.type === 'say') log('say', o.id);
            if (o.type === 'sound') log('sound', o.name);
          });
          b.onChange((snap) => {
            if (snap.oneShot && snap.oneShot.id !== lastShot) {
              lastShot = snap.oneShot.id;
              log('shot', snap.oneShot.name);
            }
            if (snap.mood !== lastMood) {
              lastMood = snap.mood;
              log('mood', snap.mood);
            }
            if (snap.fx && snap.fxId !== lastFx) {
              lastFx = snap.fxId;
              log('fx', snap.fx);
            }
          });
        }}
      />,
    );
    return () => {
      root.unmount();
      host.remove();
    };
  }, []);
  return null;
}

function EndCard() {
  return (
    <div className="endcard">
      <div className="end-sprite" dangerouslySetInnerHTML={{ __html: renderSprite({ expression: 'evil', arms: 'hold' }, 7) }} />
      <h1>
        INTERNET <span>GREMLIN</span>
      </h1>
      <p className="tag">Your browser. Its territory. Your problem.</p>
      <p className="small">Free & open-source browser extension · Chrome · Edge · 100% offline</p>
    </div>
  );
}

createRoot(document.getElementById('stage')!).render(<Demo />);
if (new URLSearchParams(location.search).has('autostart')) {
  setTimeout(() => (window as unknown as { __startDemo: () => void }).__startDemo(), 600);
}
