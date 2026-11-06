import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { Brain, type Output, type Snack, type Snapshot } from '../engine/brain';
import { applyDelta, onNewSession } from '../engine/relationship';
import { SECRETS } from '../engine/secrets';
import type { Store } from '../shared/storage';
import type { MenuAction, PetState, Position, StoredData, TabMessage } from '../shared/types';
import { renderSprite, type Arms, type Legs, type Look } from '../sprite/sprite';
import type { Bridge } from './bridge';
import { Bubble, FeedTray, FxLayer, GamePanel, Menu, Peek, StickyNote, Toast, type GamePhase } from './parts';
import { playSound } from './sound';

export interface AppProps {
  store: Store;
  bridge: Bridge;
  /** The custom element hosting our shadow root (used to ignore our own clicks). */
  hostEl: HTMLElement;
  /** >1 speeds up the inactivity ladder and ambient behaviour (promo demo only). */
  timeScale?: number;
  rng?: () => number;
  onBrain?: (b: Brain) => void;
  /** Random unprompted behaviour (only the scripted promo demo turns it off). */
  ambient?: boolean;
}

const SCALE = { small: 2, medium: 3, large: 4 } as const;
const SESSION_GAP = 30 * 60_000;
const MARGIN = 6;

type Panel = null | 'menu' | 'feed' | 'game';

interface Speech {
  text: string;
  key: number;
  thought?: boolean;
}

function useReducedMotion(pref: 'auto' | 'on' | 'off'): boolean {
  const [sys, setSys] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setSys(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return pref === 'on' || (pref === 'auto' && sys);
}

function useDarkScheme(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

export function GremlinApp({ store, bridge, hostEl, timeScale = 1, rng, onBrain, ambient = true }: AppProps) {
  const [data, setData] = useState<StoredData | null>(null);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [note, setNote] = useState<string[] | null>(null);
  const [toast, setToast] = useState<{ title: string; sub: string; key: number } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [game, setGame] = useState<GamePhase | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number; ms: number } | null>(null);
  const [walking, setWalking] = useState<-1 | 0 | 1>(0);
  const [look, setLook] = useState<{ x: Look; y: Look }>({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [frame, setFrame] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const [fullscreen, setFullscreen] = useState(false);
  const [hover, setHoverState] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setHover = useCallback((on: boolean) => {
    clearTimeout(hoverTimer.current);
    if (on) setHoverState(true);
    else hoverTimer.current = setTimeout(() => setHoverState(false), 450);
  }, []);

  const dataRef = useRef<StoredData | null>(null);
  dataRef.current = data;
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const startedRef = useRef<{ newSession: boolean; awayDays: number } | null>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: -1, y: -1, t: 0, pt: 0, dist: Infinity });
  const lastActivitySent = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const later = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  }, []);

  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);

  // ------------------------------------------------------------ load & sync
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await store.load();
      const now = Date.now();
      let pet = d.pet;
      const newSession = now - pet.lastSeen > SESSION_GAP;
      let awayDays = 0;
      if (newSession) {
        const r = onNewSession(pet, now);
        awayDays = r.awayDays;
        pet = await store.updatePet(() => r.patch);
      } else {
        pet = await store.updatePet(() => ({ lastSeen: now }));
      }
      if (cancelled) return;
      const b = new Brain({ pet, intensity: d.settings.intensity, rng, timeScale, wander: d.settings.wander, name: d.settings.name, ambient });
      startedRef.current = { newSession, awayDays };
      setData({ ...d, pet });
      setBrain(b);
      onBrain?.(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, rng, timeScale, onBrain, ambient]);

  useEffect(
    () =>
      store.subscribe((d) => {
        setData((cur) => (cur ? { ...cur, ...d } : cur));
        if (d.pet) brain?.setPet(d.pet);
        if (d.settings) {
          brain?.setIntensity(d.settings.intensity);
          if (brain) {
            if (d.settings.name !== brain.name) {
              brain.name = d.settings.name;
              brain.rename(Date.now());
            }
            brain.wander = d.settings.wander;
          }
        }
      }),
    [store, brain],
  );

  const updatePet = useCallback(
    (fn: (p: PetState) => Partial<PetState>) => {
      chain.current = chain.current
        .then(async () => {
          const p = await store.updatePet(fn);
          brain?.setPet(p);
        })
        .catch(() => undefined);
    },
    [store, brain],
  );

  const settings = data?.settings;
  const position = data?.position;
  const scale = SCALE[settings?.size ?? 'small'];
  const W = 36 * scale;
  const H = 32 * scale;
  const reduced = useReducedMotion(settings?.reducedMotion ?? 'auto');
  const sysDark = useDarkScheme();
  const dark = settings?.theme === 'dark' || (settings?.theme !== 'light' && sysDark);
  const hiddenHere = !!settings && settings.hiddenSites.includes(bridge.hostname);
  const shown = !!settings && settings.visible && !hiddenHere && !fullscreen;
  const active = shown && visible && !position?.minimized;

  // ------------------------------------------------------------ positioning
  const clampPos = useCallback(
    (left: number, top: number) => ({
      left: Math.max(MARGIN, Math.min(vp.w - W - MARGIN, left)),
      top: Math.max(MARGIN, Math.min(vp.h - H - MARGIN, top)),
    }),
    [vp, W, H],
  );
  const basePos = useMemo(() => clampPos((position?.x ?? 0.94) * vp.w, (position?.y ?? 0.7) * vp.h), [position, vp, clampPos]);
  const pos = drag ?? basePos;

  const savePos = useCallback(
    (left: number, top: number) => {
      const c = clampPos(left, top);
      void store.savePosition({ x: c.left / vp.w, y: c.top / vp.h });
    },
    [store, clampPos, vp],
  );

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const onVis = () => setVisible(!document.hidden);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  // ------------------------------------------------------------ brain outputs
  const say = useCallback(
    (text: string, ttl: number, thought = false) => {
      if (!dataRef.current?.settings.bubbles && !thought) return;
      const key = Date.now() + Math.random();
      setSpeech({ text, key, thought });
      later(ttl, () => setSpeech((s) => (s?.key === key ? null : s)));
    },
    [later],
  );

  const moveBy = useCallback(
    (dx: number, dy: number, ms: number) => {
      setOffset({ dx: 0, dy: 0, ms: 0 });
      requestAnimationFrame(() => setOffset({ dx, dy, ms }));
      later(ms + 30, () => {
        const cur = dataRef.current;
        if (!cur) return;
        const left = cur.position.x * window.innerWidth;
        const top = cur.position.y * window.innerHeight;
        savePos(left + dx, top + dy);
        setOffset(null);
      });
    },
    [later, savePos],
  );

  useEffect(() => {
    if (!brain) return;
    const offSnap = brain.onChange(setSnap);
    const offOut = brain.onOutput((o: Output) => {
      const s = dataRef.current?.settings;
      switch (o.type) {
        case 'say':
          say(o.text, o.ttl);
          break;
        case 'sound':
          if (s?.sound) playSound(o.name);
          break;
        case 'delta':
          updatePet((p) => applyDelta(p, o.delta));
          break;
        case 'pet':
          updatePet(o.patch);
          break;
        case 'secret': {
          const sec = SECRETS.find((x) => x.id === o.id);
          updatePet((p) => (p.secrets.includes(o.id) ? {} : { secrets: [...p.secrets, o.id] }));
          if (sec) {
            const found = (dataRef.current?.pet.secrets.filter((x) => x !== o.id).length ?? 0) + 1;
            const key = Date.now();
            setToast({ title: `Secret found: ${sec.name}`, sub: `${found}/${SECRETS.length} discovered`, key });
            later(4200, () => setToast((t) => (t?.key === key ? null : t)));
          }
          break;
        }
        case 'note':
          later(1200, () => setNote(o.items));
          break;
        case 'teleport':
          later(450, () => {
            const cur = dataRef.current?.position;
            let x = 0.1 + Math.random() * 0.8;
            let y = 0.18 + Math.random() * 0.65;
            if (cur && Math.hypot(x - cur.x, y - cur.y) < 0.3) {
              x = 1 - x;
              y = 1 - y;
            }
            void store.savePosition({ x, y });
          });
          break;
        case 'wander': {
          if (!s?.wander || s.animation === 'low') break;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const dist = (24 + Math.random() * 56) * dir;
          setWalking(dir as -1 | 1);
          moveBy(dist, 0, 1600);
          later(1650, () => setWalking(0));
          break;
        }
        case 'dodge': {
          const c = cursor.current;
          const away = c.x < window.innerWidth / 2 ? 1 : -1;
          moveBy(away * 150, -20, 260);
          break;
        }
      }
    });
    return () => {
      offSnap();
      offOut();
    };
  }, [brain, say, updatePet, later, store, moveBy]);

  // Start (greeting) once the creature is actually on screen.
  useEffect(() => {
    if (brain && active && startedRef.current) {
      const ctx = startedRef.current;
      startedRef.current = null;
      later(700, () => brain.start(Date.now(), ctx));
      later(4500, () => {
        void bridge.getTabCount().then((n) => {
          if (n !== null) brain.tabs(n, Date.now());
        });
      });
    }
  }, [brain, active, later, bridge]);

  // ------------------------------------------------------------ ticking
  useEffect(() => {
    if (!brain || !active) return;
    brain.visibility(true, Date.now());
    const iv = setInterval(() => brain.tick(Date.now()), 250);
    return () => {
      clearInterval(iv);
      brain.visibility(false, Date.now());
    };
  }, [brain, active]);

  // pixel-level animation frames (tail, tears, flailing)
  useEffect(() => {
    if (!active || reduced) return;
    const iv = setInterval(() => setFrame((f) => (f + 1) % 1200), 200);
    return () => clearInterval(iv);
  }, [active, reduced]);

  // blinking
  useEffect(() => {
    if (!shown || !visible) return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2200 + Math.random() * 4200);
    };
    schedule();
    return () => clearTimeout(t);
  }, [shown, visible]);

  // eyes: follow the cursor, or wander when bored
  const center = useRef({ x: 0, y: 0 });
  center.current = { x: pos.left + W / 2, y: pos.top + H * 0.45 };
  useEffect(() => {
    if (!active) return;
    let wanderIdx = 0;
    const wanderSeq: [Look, Look][] = [
      [-1, 0],
      [-1, 0],
      [0, 0],
      [1, 0],
      [1, -1],
      [0, 0],
      [1, 0],
      [-1, 1],
    ];
    const iv = setInterval(() => {
      const s = brain?.snapshot;
      if (s?.stare) {
        setLook((l) => (l.x === 0 && l.y === 0 ? l : { x: 0, y: 0 }));
        return;
      }
      if (s?.lookAround || Date.now() - cursor.current.t > 8000) {
        wanderIdx = (wanderIdx + 1) % wanderSeq.length;
        const [x, y] = wanderSeq[wanderIdx];
        setLook({ x, y });
        return;
      }
      const dx = cursor.current.x - center.current.x;
      const dy = cursor.current.y - center.current.y;
      const x: Look = dx > 36 ? 1 : dx < -36 ? -1 : 0;
      const y: Look = dy > 40 ? 1 : dy < -40 ? -1 : 0;
      setLook((l) => (l.x === x && l.y === y ? l : { x, y }));
    }, 140);
    return () => clearInterval(iv);
  }, [active, brain]);

  // ------------------------------------------------------------ page activity
  useEffect(() => {
    if (!brain || !active) return;
    const own = (e: Event) => e.composedPath().includes(hostEl);
    const ping = () => {
      const now = Date.now();
      if (now - lastActivitySent.current > 800) {
        lastActivitySent.current = now;
        brain.activity(now);
      }
    };
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const pnow = performance.now();
      const c = cursor.current;
      const dist = Math.hypot(e.clientX - center.current.x, e.clientY - center.current.y);
      const dt = Math.max(1, pnow - c.pt);
      const approach = (c.dist - dist) / dt;
      cursor.current = { x: e.clientX, y: e.clientY, t: Date.now(), pt: pnow, dist };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          ping();
          if (dist < 120 && approach > 1.6 && !own(e)) brain.cursorRush(Date.now());
        });
      }
    };
    const onDown = (e: PointerEvent) => {
      if (own(e)) return;
      brain.pageClick(Date.now());
      setPanel((p) => (p === 'menu' || p === 'feed' ? null : p));
    };
    const onWheel = (e: WheelEvent) => brain.scroll(e.deltaY, Date.now());
    const onKey = (e: KeyboardEvent) => {
      // We only care that *a* key was pressed. The key itself is never read or stored,
      // except Escape to close our own menu.
      if (e.key === 'Escape') setPanel(null);
      ping();
    };
    window.addEventListener('pointermove', onMove, { passive: true, capture: true });
    window.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    window.addEventListener('wheel', onWheel, { passive: true, capture: true });
    window.addEventListener('keydown', onKey, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove, { capture: true });
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [brain, active, hostEl]);

  // ------------------------------------------------------------ actions
  const startGame = useCallback(() => {
    if (!brain) return;
    setPanel('game');
    brain.gameStart(Date.now());
    const at = Date.now() + 1600 + Math.random() * 2600;
    setGame({ phase: 'wait', at });
    later(at - Date.now(), () => setGame((g) => (g && g.phase === 'wait' && g.at === at ? { phase: 'now', at: Date.now() } : g)));
  }, [brain, later]);

  const gameHit = useCallback(() => {
    if (!brain || !game) return;
    const now = Date.now();
    if (game.phase === 'wait') {
      brain.gameResult('early', now);
      setGame({ phase: 'done', text: 'Too early!' });
    } else if (game.phase === 'now') {
      const ms = now - game.at;
      brain.gameResult(ms, now);
      setGame({ phase: 'done', text: `${ms} ms` });
    }
  }, [brain, game]);

  const showThought = useCallback(() => {
    if (!brain) return;
    say(brain.thought(), 5200, true);
  }, [brain, say]);

  const handleAction = useCallback(
    (a: MenuAction | 'minimize' | 'hideSite' | 'settings') => {
      if (!brain) return;
      const now = Date.now();
      if (a !== 'feed' && a !== 'play') setPanel(null);
      switch (a) {
        case 'pet':
          brain.pet(now);
          break;
        case 'feed':
          setPanel('feed');
          break;
        case 'play':
          startGame();
          break;
        case 'mood':
          brain.randomMood(now);
          break;
        case 'thoughts':
          showThought();
          break;
        case 'summon':
          void store.savePosition({ minimized: false, x: 0.5 - W / 2 / window.innerWidth, y: 0.55 });
          brain.summon(now);
          break;
        case 'minimize':
          brain.minimized(now, true);
          later(900, () => void store.savePosition({ minimized: true }));
          break;
        case 'hideSite':
          if (dataRef.current) void store.saveSettings({ hiddenSites: [...new Set([...dataRef.current.settings.hiddenSites, bridge.hostname])] });
          break;
        case 'settings':
          bridge.openOptions();
          break;
      }
    },
    [brain, startGame, showThought, store, later, bridge, W],
  );

  useEffect(
    () =>
      bridge.onMessage((m: TabMessage) => {
        if (!brain) return;
        const now = Date.now();
        if (m.type === 'tabs') brain.tabs(m.count, now);
        if (m.type === 'tabStorm') brain.tabStorm(now);
        if (m.type === 'action') {
          if (m.action === 'summon' && dataRef.current) {
            const s = dataRef.current.settings;
            if (!s.visible || s.hiddenSites.includes(bridge.hostname)) {
              void store.saveSettings({ visible: true, hiddenSites: s.hiddenSites.filter((h) => h !== bridge.hostname) });
            }
          }
          handleAction(m.action);
        }
      }),
    [bridge, brain, handleAction, store],
  );

  // ------------------------------------------------------------ pointer: poke / drag / pet
  const gesture = useRef<{
    id: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    dragging: boolean;
    lastX: number;
    lastY: number;
    lastT: number;
    dirX: number;
    reversals: number[];
    heading: number | null;
    turn: number;
  } | null>(null);
  const rub = useRef({ lastX: 0, dir: 0, reversals: [] as number[], travel: 0 });

  const onSpriteDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !brain) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: e.clientX - pos.left,
      oy: e.clientY - pos.top,
      dragging: false,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      dirX: 0,
      reversals: [],
      heading: null,
      turn: 0,
    };
  };

  const onSpriteMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const now = performance.now();
    if (g && g.id === e.pointerId) {
      if (!g.dragging && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 5) {
        g.dragging = true;
        setPanel(null);
        brain?.dragStart(Date.now());
      }
      if (g.dragging) {
        setDrag(clampPos(e.clientX - g.ox, e.clientY - g.oy));
        const dx = e.clientX - g.lastX;
        const dy = e.clientY - g.lastY;
        // shake detection: fast horizontal direction reversals
        const dir = Math.sign(dx);
        if (dir && Math.abs(dx) > 6 && dir !== g.dirX) {
          if (g.dirX) g.reversals = [...g.reversals.filter((t) => now - t < 900), now];
          g.dirX = dir;
          if (g.reversals.length >= 5) {
            g.reversals = [];
            brain?.dragShake(Date.now());
          }
        }
        // circle detection: accumulated heading change
        if (Math.hypot(dx, dy) > 4) {
          const h = Math.atan2(dy, dx);
          if (g.heading !== null) {
            let d = h - g.heading;
            if (d > Math.PI) d -= Math.PI * 2;
            if (d < -Math.PI) d += Math.PI * 2;
            g.turn += d;
            if (Math.abs(g.turn) > Math.PI * 3.2) {
              g.turn = 0;
              brain?.dragCircle(Date.now());
            }
          }
          g.heading = h;
        }
        g.lastX = e.clientX;
        g.lastY = e.clientY;
        g.lastT = now;
      }
      return;
    }
    // Hovering without pressing: rubbing back and forth = petting.
    const r = rub.current;
    const dx = e.clientX - r.lastX;
    r.lastX = e.clientX;
    if (Math.abs(dx) < 2) return;
    r.travel += Math.abs(dx);
    const dir = Math.sign(dx);
    if (dir !== r.dir) {
      r.dir = dir;
      r.reversals = [...r.reversals.filter((t) => now - t < 1400), now];
      if (r.reversals.length >= 4 && r.travel > 50) {
        r.reversals = [];
        r.travel = 0;
        brain?.pet(Date.now());
      }
    }
  };

  const onSpriteUp = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.dragging) {
      const p = clampPos(e.clientX - g.ox, e.clientY - g.oy);
      void store.savePosition({ x: p.left / vp.w, y: p.top / vp.h });
      // keep the drag position until storage confirms, to avoid a flicker
      later(120, () => setDrag(null));
      brain?.dragEnd(Date.now());
    } else if (game && game.phase !== 'done') {
      gameHit();
    } else {
      brain?.poke(Date.now());
    }
  };

  const onContext = (e: ReactMouseEvent) => {
    e.preventDefault();
    setPanel((p) => (p === 'menu' ? null : 'menu'));
  };

  // ------------------------------------------------------------ render
  if (!data || !settings || !snap) return null;

  if (!shown) return null;

  const peekBlink = blink;
  if (position?.minimized) {
    return (
      <div className="ig-root" data-theme={dark ? 'dark' : 'light'}>
        <Peek
          left={Math.max(MARGIN, Math.min(vp.w - W - MARGIN, basePos.left))}
          scale={scale}
          blink={peekBlink}
          onRestore={() => {
            void store.savePosition({ minimized: false });
            brain?.minimized(Date.now(), false);
          }}
        />
      </div>
    );
  }

  const dragging = !!drag;
  const arms: Arms | undefined = dragging ? 'up' : game?.phase === 'now' ? 'up' : snap.arms;
  const dancing = snap.oneShot?.name === 'dance';
  const legs: Legs = walking || dancing ? (frame % 2 ? 'stepL' : 'stepR') : 'stand';
  const expression = game?.phase === 'wait' ? 'suspicious' : game?.phase === 'now' ? 'shocked' : snap.expression;
  const svg = renderSprite(
    {
      expression,
      lookX: look.x,
      lookY: look.y,
      blink: blink && !snap.stare,
      arms,
      legs,
      golden: snap.golden,
      frame: reduced ? 0 : frame,
    },
    scale,
  );

  const placeBelow = pos.top < 110;
  const align = pos.left < 140 ? 'left' : pos.left > vp.w - 200 ? 'right' : 'center';
  const amp = settings.animation === 'low' ? 0.5 : settings.animation === 'extra' ? 1.6 : 1;
  const style: CSSProperties = {
    left: pos.left,
    top: pos.top,
    width: W,
    height: H,
    ['--amp' as string]: amp,
    ['--s' as string]: scale,
    transform: offset ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
    transition: offset ? `transform ${offset.ms}ms ${offset.ms > 400 ? 'linear' : 'cubic-bezier(.2,.9,.3,1.4)'}` : undefined,
  };
  const loopFx = snap.fx === 'zzz' || (snap.fx === 'hearts' && snap.mood === 'AFFECTIONATE');
  const panelBelow = pos.top < 220;
  const panelSide = pos.left > vp.w / 2 ? 'left' : 'right';

  return (
    <div className="ig-root" data-theme={dark ? 'dark' : 'light'} data-motion={reduced ? 'reduced' : 'full'}>
      <div className={`ig-gremlin ${dragging ? 'is-dragging' : ''} ${hover ? 'is-hover' : ''}`} style={style}>
        {speech && !panel && <Bubble key={speech.key} text={speech.text} placeBelow={placeBelow} align={align} instant={reduced} thought={speech.thought} />}
        <div className={`ig-body loop-${dragging ? 'dangle' : snap.loop}`}>
          <div key={snap.oneShot?.id ?? 0} className={`ig-shot ${snap.oneShot && !reduced ? `shot-${snap.oneShot.name}` : ''}`}>
            <div className={`ig-hide ${snap.hidden ? `hidden-${snap.hidden}` : ''}`}>
              <div className={`ig-face ${walking === -1 ? 'flip' : ''}`}>
                <div
                  ref={spriteRef}
                  className="ig-sprite"
                  role="img"
                  aria-label={`${settings.name} the Internet Gremlin looks ${expression}`}
                  title={dragging ? '' : `${settings.name} — click to poke, rub to pet, drag to move, right-click for menu`}
                  onPointerDown={onSpriteDown}
                  onPointerMove={onSpriteMove}
                  onPointerUp={onSpriteUp}
                  onPointerCancel={() => {
                    gesture.current = null;
                    setDrag(null);
                  }}
                  onPointerEnter={() => setHover(true)}
                  onPointerLeave={() => setHover(false)}
                  onContextMenu={onContext}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </div>
          </div>
        </div>
        {!reduced && <FxLayer fx={snap.fx} id={snap.fxId} scale={scale} loop={loopFx} />}
        <button
          className="ig-more"
          aria-label="Open Gremlin menu"
          title="Menu"
          onClick={() => setPanel((p) => (p === 'menu' ? null : 'menu'))}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
        >
          <i />
          <i />
          <i />
        </button>
        <div className={`ig-panel ${panelBelow ? 'below' : 'above'} side-${panelSide}`}>
          {panel === 'menu' && <Menu name={settings.name} onAction={handleAction} onClose={() => setPanel(null)} />}
          {panel === 'feed' && (
            <FeedTray
              onFeed={(s: Snack) => {
                brain?.feed(s, Date.now());
                setPanel(null);
              }}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'game' && game && (
            <GamePanel
              game={game}
              onHit={gameHit}
              onAgain={startGame}
              onClose={() => {
                setPanel(null);
                setGame(null);
              }}
            />
          )}
        </div>
        {note && (
          <div className={`ig-note-wrap ${panelSide}`}>
            <StickyNote name={settings.name} items={note} onClose={() => setNote(null)} />
          </div>
        )}
      </div>
      {toast && (
        <div className="ig-toast-wrap" key={toast.key}>
          <Toast title={toast.title} sub={toast.sub} />
        </div>
      )}
    </div>
  );
}

export type { Position };
