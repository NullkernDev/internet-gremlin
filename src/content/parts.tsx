import { useEffect, useRef, useState } from 'react';
import type { Fx } from '../engine/moods';
import type { Snack } from '../engine/brain';
import { stampSvg, type StampName } from '../sprite/fx';
import { renderSprite } from '../sprite/sprite';

export function Pixel({ name, scale = 2, className }: { name: StampName; scale?: number; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: stampSvg(name, scale) }} />;
}

const FX_STAMP: Partial<Record<Fx, StampName>> = {
  zzz: 'z',
  hearts: 'heart',
  question: 'question',
  exclaim: 'exclaim',
  sparkle: 'sparkle',
  anger: 'anger',
  notes: 'note',
  sweat: 'drop',
  crumbs: 'crumb',
  tears: 'tear',
};

const CONFETTI = ['#b8ff3c', '#ff4f9a', '#fff36b', '#4cc8ff', '#a982ff', '#ffffff'];

/** Floating pixel effects above the Gremlin. */
export function FxLayer({ fx, id, scale, loop }: { fx: Fx | null; id: number; scale: number; loop: boolean }) {
  if (!fx) return null;
  if (fx === 'confetti') {
    return (
      <div className="ig-fx" key={id}>
        {Array.from({ length: 18 }, (_, i) => (
          <i
            key={i}
            className="ig-confetti"
            style={{
              background: CONFETTI[i % CONFETTI.length],
              ['--dx' as string]: `${Math.round(Math.cos((i / 18) * Math.PI * 2) * (40 + (i % 3) * 18))}px`,
              ['--dy' as string]: `${Math.round(Math.sin((i / 18) * Math.PI * 2) * (34 + (i % 4) * 10) - 30)}px`,
              animationDelay: `${(i % 5) * 30}ms`,
            }}
          />
        ))}
      </div>
    );
  }
  const stamp = FX_STAMP[fx];
  if (!stamp) return null;
  const count = fx === 'zzz' ? 3 : fx === 'crumbs' || fx === 'tears' ? 5 : fx === 'hearts' ? 3 : fx === 'sparkle' ? 4 : 1;
  return (
    <div className={`ig-fx ig-fx-${fx} ${loop ? 'ig-fx-loop' : ''}`} key={id}>
      {Array.from({ length: count }, (_, i) => (
        <Pixel key={i} name={stamp} scale={Math.max(1, scale - (fx === 'crumbs' || fx === 'tears' ? 0 : 0.5))} className={`ig-fx-item ig-fx-i${i}`} />
      ))}
    </div>
  );
}

/** Speech bubble with a quick typewriter effect. */
export function Bubble({ text, placeBelow, align, instant, thought }: { text: string; placeBelow: boolean; align: 'left' | 'right' | 'center'; instant: boolean; thought?: boolean }) {
  const [shown, setShown] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) return;
    let i = 0;
    const iv = setInterval(() => {
      i += 2;
      setShown(Math.min(text.length, i));
      if (i >= text.length) clearInterval(iv);
    }, 28);
    return () => clearInterval(iv);
  }, [text, instant]);
  return (
    <div className={`ig-bubble ${placeBelow ? 'below' : 'above'} align-${align} ${thought ? 'thought' : ''}`} role="status" aria-live="polite">
      <span className="ig-bubble-text">{instant ? text : text.slice(0, shown)}</span>
      <span className="ig-bubble-ghost" aria-hidden="true">
        {text}
      </span>
    </div>
  );
}

export interface MenuProps {
  name: string;
  onAction: (a: 'pet' | 'feed' | 'play' | 'mood' | 'thoughts' | 'minimize' | 'hideSite' | 'settings') => void;
  onClose: () => void;
}

export function Menu({ name, onAction, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  const items: [Parameters<MenuProps['onAction']>[0], string, string][] = [
    ['pet', 'Pet', '♥'],
    ['feed', 'Feed', '◆'],
    ['play', 'Play', '▶'],
    ['mood', 'Mood dice', '⚄'],
    ['thoughts', 'Thoughts', '…'],
    ['minimize', 'Minimize', '_'],
    ['hideSite', 'Hide on this site', '×'],
    ['settings', 'Settings', '⚙'],
  ];
  return (
    <div className="ig-window ig-menu" ref={ref} role="menu" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="ig-titlebar">
        <span className="ig-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="ig-title">{name.toUpperCase()}.EXE</span>
        <button className="ig-x" onClick={onClose} aria-label="Close menu">
          ×
        </button>
      </div>
      <div className="ig-menu-grid">
        {items.map(([id, label, icon]) => (
          <button key={id} role="menuitem" className="ig-menu-btn" onClick={() => onAction(id)}>
            <span className="ig-menu-icon" aria-hidden="true">
              {icon}
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeedTray({ onFeed, onClose }: { onFeed: (s: Snack) => void; onClose: () => void }) {
  const snacks: [Snack, StampName, string][] = [
    ['cookie', 'cookie', 'Cookie'],
    ['byte', 'byte', 'Byte'],
    ['bug', 'bug', 'Bug'],
  ];
  return (
    <div className="ig-window ig-tray" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="ig-titlebar">
        <span className="ig-title">SNACKS</span>
        <button className="ig-x" onClick={onClose} aria-label="Close snacks">
          ×
        </button>
      </div>
      <div className="ig-tray-row">
        {snacks.map(([id, stamp, label]) => (
          <button key={id} className="ig-snack" onClick={() => onFeed(id)} aria-label={`Feed a ${label}`}>
            <Pixel name={stamp} scale={3} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export type GamePhase = { phase: 'wait'; at: number } | { phase: 'now'; at: number } | { phase: 'done'; text: string };

export function GamePanel({ game, onAgain, onClose, onHit }: { game: GamePhase; onAgain: () => void; onClose: () => void; onHit: () => void }) {
  return (
    <div className="ig-window ig-game" onPointerDown={game.phase !== 'done' ? onHit : undefined}>
      <div className="ig-titlebar">
        <span className="ig-title">REACTION.EXE</span>
        <button
          className="ig-x"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close game"
        >
          ×
        </button>
      </div>
      <div className={`ig-game-body ${game.phase}`}>
        {game.phase === 'wait' && <strong>wait for it…</strong>}
        {game.phase === 'now' && <strong className="ig-now">NOW!</strong>}
        {game.phase === 'done' && (
          <>
            <strong>{game.text}</strong>
            <button
              className="ig-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onAgain();
              }}
            >
              Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function StickyNote({ name, items, onClose }: { name: string; items: string[]; onClose: () => void }) {
  return (
    <button className="ig-note" onClick={onClose} aria-label="Dismiss note">
      <span className="ig-note-pin" aria-hidden="true" />
      <strong>While you were out:</strong>
      <ul>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      <em>— {name}</em>
    </button>
  );
}

export function Toast({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="ig-toast" role="status">
      <Pixel name="sparkle" scale={3} />
      <div>
        <strong>{title}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

/** Minimised: only the ears and eyes peek over the bottom edge. */
export function Peek({ left, scale, blink, onRestore }: { left: number; scale: number; blink: boolean; onRestore: () => void }) {
  const svg = renderSprite({ expression: 'neutral', blink, lookY: -1 }, scale);
  return (
    <button className="ig-peek" style={{ left, width: 36 * scale, height: 18 * scale }} onClick={onRestore} aria-label="Bring the Gremlin back" title="Bring the Gremlin back">
      <span className="ig-peek-inner" dangerouslySetInnerHTML={{ __html: svg }} />
    </button>
  );
}
