import { useEffect, useState, type ReactNode } from 'react';
import { createStore, type Store } from '../shared/storage';
import type { StoredData, Theme } from '../shared/types';
import { renderSprite, type Arms, type Expression } from '../sprite/sprite';

export const store: Store = createStore();

/** Load stored data and keep it in sync with chrome.storage. */
export function useData(): StoredData | null {
  const [data, setData] = useState<StoredData | null>(null);
  useEffect(() => {
    let alive = true;
    void store.load().then((d) => alive && setData(d));
    const off = store.subscribe((d) => setData((cur) => (cur ? { ...cur, ...d } : cur)));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return data;
}

export function useTheme(theme: Theme | undefined): void {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme !== 'light' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function Win({ title, children, right, className = '', id }: { title: string; children: ReactNode; right?: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`win ${className}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <header className="win-title">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="grow" id={id ? `${id}-title` : undefined}>
          {title}
        </span>
        {right}
      </header>
      <div className="win-body">{children}</div>
    </section>
  );
}

/** An animated, blinking sprite for extension pages. */
export function Sprite({
  expression,
  scale = 4,
  arms,
  className = '',
  blinking = true,
  golden = false,
  label,
}: {
  expression: Expression;
  scale?: number;
  arms?: Arms;
  className?: string;
  blinking?: boolean;
  golden?: boolean;
  label?: string;
}) {
  const [blink, setBlink] = useState(false);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!blinking) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(
        () => {
          setBlink(true);
          t = setTimeout(() => {
            setBlink(false);
            loop();
          }, 140);
        },
        2000 + Math.random() * 3500,
      );
    };
    loop();
    return () => clearTimeout(t);
  }, [blinking]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const iv = setInterval(() => setFrame((f) => (f + 1) % 1200), 200);
    return () => clearInterval(iv);
  }, []);
  return (
    <span
      className={`sprite ${className}`}
      role="img"
      aria-label={label ?? `Gremlin looking ${expression}`}
      dangerouslySetInnerHTML={{ __html: renderSprite({ expression, blink, arms, frame, golden }, scale) }}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="toggle" onClick={() => onChange(!checked)}>
      <span className="track">
        <span className="knob" />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.round(value);
  return (
    <div className="bar">
      <span>{label}</span>
      <div className="bar-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
        <div className="bar-fill" style={{ width: `${v}%`, ['--c' as string]: color }} />
      </div>
      <span className="bar-val">{v}</span>
    </div>
  );
}
