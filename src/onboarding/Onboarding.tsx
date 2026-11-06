import { useEffect, useState } from 'react';
import type { Intensity } from '../shared/types';
import { stampSvg } from '../sprite/fx';
import type { Expression } from '../sprite/sprite';
import { Sprite, store, useData, useTheme, Win } from '../ui/kit';

const STEPS = ['hatch', 'name', 'controls', 'personality', 'privacy', 'done'] as const;
type Step = (typeof STEPS)[number];

const PERSONALITIES: [Intensity, string, Expression, string][] = [
  ['chill', 'Chill', 'bored', '“…hm. Nice tab.”'],
  ['normal', 'Normal', 'happy', '“Again? You clicked again?”'],
  ['unhinged', 'Unhinged', 'evil', '“I AM THE CAPTAIN OF THESE TABS NOW.”'],
];

const CONTROLS: [string, string, Expression, 'up' | undefined][] = [
  ['Drag', 'Grab it and put it anywhere. It might complain.', 'shocked', 'up'],
  ['Click', 'Poke it. Gently. Or not.', 'suspicious', undefined],
  ['Rub', 'Move your cursor back and forth over it to pet it.', 'love', undefined],
  ['Right-click', 'Or the ••• handle: pet, feed, play, minimize, settings.', 'proud', undefined],
];

export function Onboarding() {
  const data = useData();
  useTheme(data?.settings.theme);
  const [step, setStep] = useState<Step>('hatch');
  const [cracks, setCracks] = useState(0);
  const [name, setName] = useState('Gorp');
  const [intensity, setIntensity] = useState<Intensity>('normal');

  const idx = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]);
  const back = () => setStep(STEPS[Math.max(0, idx - 1)]);

  useEffect(() => {
    if (step !== 'hatch' || cracks >= 3) return;
    const t = setTimeout(() => setCracks((c) => c + 1), 900);
    return () => clearTimeout(t);
  }, [step, cracks]);

  const finish = async () => {
    await store.saveSettings({ name: name.trim() || 'Gorp', intensity, onboarded: true });
    setStep('done');
  };

  return (
    <div className="sky onb">
      <div className="onb-wrap">
        <Win title={`hello_human.exe — step ${idx + 1}/${STEPS.length}`} id="onb" className="onb-win">
          {step === 'hatch' && (
            <div className="onb-step center">
              {cracks < 3 ? (
                <button className="egg" onClick={() => setCracks(3)} aria-label="Hatch the egg">
                  <span className={`egg-img shake-${cracks}`} dangerouslySetInnerHTML={{ __html: stampSvg('egg', 14) }} />
                  <span className="muted">Something is hatching… (click to help)</span>
                </button>
              ) : (
                <>
                  <div className="hatched">
                    <Sprite expression="shocked" scale={6} className="pop-in" />
                  </div>
                  <h1>Oh. A human.</h1>
                  <p className="lead">I’m a gremlin. I live in your browser now. You can’t stop this.</p>
                  <button className="btn primary" onClick={next} autoFocus>
                    Hello…?
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'name' && (
            <div className="onb-step center">
              <Sprite expression="innocent" scale={5} className="bob" />
              <h2>What will you call me?</h2>
              <input className="field big" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} aria-label="Gremlin name" autoFocus />
              <p className="muted">{name.trim() ? `“${name.trim()}”… I’ll allow it.` : 'A name, please. I’m not a “hey you”.'}</p>
              <Nav back={back} next={next} disabled={!name.trim()} />
            </div>
          )}

          {step === 'controls' && (
            <div className="onb-step">
              <h2>How to handle {name.trim() || 'me'}</h2>
              <ul className="controls">
                {CONTROLS.map(([title, text, expr, arms]) => (
                  <li key={title}>
                    <Sprite expression={expr} arms={arms} scale={2} className={title === 'Drag' ? 'dangle' : 'bob'} />
                    <div>
                      <strong>{title}</strong>
                      <span>{text}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted small">It also notices when you click around, scroll, go idle, come back, open way too many tabs, or switch tabs like a maniac.</p>
              <Nav back={back} next={next} />
            </div>
          )}

          {step === 'personality' && (
            <div className="onb-step">
              <h2>Pick a personality intensity</h2>
              <div className="personas" role="radiogroup" aria-label="Personality intensity">
                {PERSONALITIES.map(([id, label, expr, sample]) => (
                  <button key={id} role="radio" aria-checked={intensity === id} className={`persona ${intensity === id ? 'on' : ''}`} onClick={() => setIntensity(id)}>
                    <Sprite expression={expr} scale={3} blinking={false} />
                    <strong>{label}</strong>
                    <em>{sample}</em>
                  </button>
                ))}
              </div>
              <p className="muted small">You can change this any time in Settings.</p>
              <Nav back={back} next={next} />
            </div>
          )}

          {step === 'privacy' && (
            <div className="onb-step">
              <h2>The privacy part (it’s short)</h2>
              <ul className="promises">
                <li>
                  <b>✓</b> Runs 100% on your computer. No servers, accounts, analytics or AI APIs.
                </li>
                <li>
                  <b>✓</b> Notices <em>that</em> you click, scroll or type — never <em>what</em>. No page text, passwords, forms, URLs or history.
                </li>
                <li>
                  <b>✓</b> Stores only its own settings, mood and memories in <code>chrome.storage.local</code>.
                </li>
              </ul>
              <h3>Permissions, in plain words</h3>
              <ul className="perms">
                <li>
                  <strong>“Read and change data on websites”</strong> — needed to draw the Gremlin on top of pages. It only adds itself; it doesn’t read the page.
                </li>
                <li>
                  <strong>Storage</strong> — to remember your relationship and settings.
                </li>
              </ul>
              <div className="onb-nav">
                <button className="btn" onClick={back}>
                  Back
                </button>
                <button className="btn primary" onClick={() => void finish()}>
                  Release the gremlin
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="onb-step center">
              <Sprite expression="evil" scale={6} arms="hold" className="bob" />
              <h1>Go browse.</h1>
              <p className="lead">I’ll be in the corner. Judging.</p>
              <p className="muted small">Already-open tabs need a refresh before I can move in. Find me in the toolbar puzzle-piece menu — pin me for quick access.</p>
              <div className="onb-nav center">
                <button className="btn primary" onClick={() => void chrome.tabs.create({ url: 'https://en.wikipedia.org/wiki/Special:Random' })}>
                  Open a random page
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    void chrome.tabs.getCurrent().then((t) => {
                      if (t?.id !== undefined) void chrome.tabs.remove(t.id);
                    })
                  }
                >
                  Close this tab
                </button>
              </div>
            </div>
          )}
        </Win>
        <p className="tagline">Your browser. Its territory. Your problem.</p>
      </div>
    </div>
  );
}

function Nav({ back, next, disabled }: { back: () => void; next: () => void; disabled?: boolean }) {
  return (
    <div className="onb-nav">
      <button className="btn" onClick={back}>
        Back
      </button>
      <button className="btn primary" onClick={next} disabled={disabled}>
        Next
      </button>
    </div>
  );
}
