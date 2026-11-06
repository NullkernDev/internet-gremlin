import { useState } from 'react';
import { LINES, LINE_COUNT } from '../engine/dialogue';
import { MOOD_LABEL, type Mood } from '../engine/moods';
import { daysTogether, FAVORITE_LABEL, favoriteOf, formatDuration, TIER_BLURB, TIER_NAMES, tierOf } from '../engine/relationship';
import { SECRETS } from '../engine/secrets';
import type { AnimLevel, Intensity, Settings, Size, Theme, TriState } from '../shared/types';
import { CORE_EXPRESSIONS, EXPRESSION_LABELS } from '../sprite/sprite';
import { Bar, Seg, Sprite, store, Toggle, useData, useTheme, Win } from '../ui/kit';

const INTENSITY_HELP: Record<Intensity, string> = {
  chill: 'Speaks rarely. Mostly vibes.',
  normal: 'Chatty but polite. The intended experience.',
  unhinged: 'Talks a lot, reacts to everything. You asked for this.',
};

export function Options() {
  const data = useData();
  useTheme(data?.settings.theme);
  const [dump, setDump] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'relationship' | 'everything'>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  if (!data) return <div className="sky" />;
  const { settings, pet } = data;
  const set = (patch: Partial<Settings>) => void store.saveSettings(patch);
  const tier = tierOf(pet);
  const fav = favoriteOf(pet);
  const mood = (pet.mood in MOOD_LABEL ? pet.mood : 'IDLE') as Mood;

  const doReset = async () => {
    if (!confirm) return;
    await store.reset(confirm);
    setConfirm(null);
    setDump(null);
  };

  return (
    <div className="sky">
      <div className="opt">
        <header className="opt-head">
          <Sprite expression="proud" scale={3} className="bob" />
          <div>
            <h1>Internet Gremlin</h1>
            <p>Your browser. Its territory. Your problem.</p>
          </div>
        </header>

        <div className="opt-grid">
          <Win title="settings.exe" id="settings" className="span2">
            <div className="rows">
              <div className="row">
                <label htmlFor="name">Name</label>
                <div>
                  <input
                    id="name"
                    className="field"
                    maxLength={18}
                    value={nameDraft ?? settings.name}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => {
                      const n = (nameDraft ?? '').trim();
                      if (n && n !== settings.name) set({ name: n });
                      setNameDraft(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                </div>
              </div>
              <div className="row">
                <span>Personality</span>
                <div>
                  <Seg<Intensity>
                    label="Personality intensity"
                    value={settings.intensity}
                    onChange={(v) => set({ intensity: v })}
                    options={[
                      ['chill', 'Chill'],
                      ['normal', 'Normal'],
                      ['unhinged', 'Unhinged'],
                    ]}
                  />
                  <p className="help">{INTENSITY_HELP[settings.intensity]}</p>
                </div>
              </div>
              <div className="row">
                <span>Animation</span>
                <div>
                  <Seg<AnimLevel>
                    label="Animation intensity"
                    value={settings.animation}
                    onChange={(v) => set({ animation: v })}
                    options={[
                      ['low', 'Subtle'],
                      ['normal', 'Normal'],
                      ['extra', 'Extra'],
                    ]}
                  />
                  <p className="help">Subtle also stops it wandering around.</p>
                </div>
              </div>
              <div className="row">
                <span>Reduced motion</span>
                <div>
                  <Seg<TriState>
                    label="Reduced motion"
                    value={settings.reducedMotion}
                    onChange={(v) => set({ reducedMotion: v })}
                    options={[
                      ['auto', 'Follow system'],
                      ['on', 'On'],
                      ['off', 'Off'],
                    ]}
                  />
                  <p className="help">On = expressions only. No jumping, spinning, or teleporting.</p>
                </div>
              </div>
              <div className="row">
                <span>Theme</span>
                <Seg<Theme>
                  label="Theme"
                  value={settings.theme}
                  onChange={(v) => set({ theme: v })}
                  options={[
                    ['auto', 'Auto'],
                    ['light', 'Light'],
                    ['dark', 'Dark'],
                  ]}
                />
              </div>
              <div className="row">
                <span>Size</span>
                <Seg<Size>
                  label="Size"
                  value={settings.size}
                  onChange={(v) => set({ size: v })}
                  options={[
                    ['small', 'Compact'],
                    ['medium', 'Cozy'],
                    ['large', 'Chonky'],
                  ]}
                />
              </div>
              <div className="row toggles">
                <Toggle checked={settings.visible} onChange={(v) => set({ visible: v })} label="Visible on pages" />
                <Toggle checked={settings.bubbles} onChange={(v) => set({ bubbles: v })} label="Speech bubbles" />
                <Toggle checked={settings.sound} onChange={(v) => set({ sound: v })} label="Sound effects (mute = off)" />
                <Toggle checked={settings.wander} onChange={(v) => set({ wander: v })} label="Let it wander a little" />
              </div>
            </div>
          </Win>

          <Win title="relationship.exe" id="rel">
            <div className="rel-top">
              <div className="rel-stage">
                <Sprite expression={pet.expression} scale={3} className="breathe" />
              </div>
              <div>
                <span className="chip">{TIER_NAMES[tier]}</span>
                <p className="help">{TIER_BLURB[tier]}</p>
                <p className="help">
                  Currently: <strong>{MOOD_LABEL[mood]}</strong>
                </p>
              </div>
            </div>
            <Bar label="Affection" value={pet.affection} color="#ff4f9a" />
            <Bar label="Trust" value={pet.trust} color="#b8ff3c" />
            <Bar label="Chaos" value={pet.chaos} color="#a982ff" />
            <dl className="stats">
              <dt>Days together</dt>
              <dd>{daysTogether(pet)}</dd>
              <dt>Visits</dt>
              <dd>{pet.visits}</dd>
              <dt>Time together</dt>
              <dd>{formatDuration(pet.totalTimeMs)}</dd>
              <dt>Interactions</dt>
              <dd>{pet.interactions}</dd>
              <dt>Snacks eaten</dt>
              <dd>{pet.snacksEaten}</dd>
              <dt>Favourite thing</dt>
              <dd>{fav ? FAVORITE_LABEL[fav] : 'Undecided'}</dd>
              <dt>Best reaction</dt>
              <dd>{pet.bestReactionMs ? `${pet.bestReactionMs} ms` : '—'}</dd>
              <dt>Golden sightings</dt>
              <dd>{pet.goldenSightings}</dd>
            </dl>
            {pet.grudge > 0 && <p className="grudge">It’s holding a grudge. {pet.grudge} nice gesture(s) until forgiveness.</p>}
            <button className="btn danger small" onClick={() => setConfirm('relationship')}>
              Reset relationship
            </button>
          </Win>

          <Win title={`secrets.exe — ${pet.secrets.length}/${SECRETS.length}`} id="secrets" className="span2">
            <ul className="secrets">
              {SECRETS.map((s) => {
                const got = pet.secrets.includes(s.id);
                return (
                  <li key={s.id} className={got ? 'got' : 'locked'}>
                    <strong>{got ? s.name : '???'}</strong>
                    <span>{got ? s.description : s.hint}</span>
                  </li>
                );
              })}
            </ul>
          </Win>

          <Win title={`gremlindex.exe — ${CORE_EXPRESSIONS.filter((e) => pet.seen.includes(e)).length}/15 seen`} id="dex">
            <ul className="dex">
              {CORE_EXPRESSIONS.map((e) => {
                const seen = pet.seen.includes(e);
                return (
                  <li key={e} className={seen ? 'seen' : 'unseen'} title={seen ? EXPRESSION_LABELS[e] : 'Not witnessed yet'}>
                    <Sprite expression={e} scale={2} blinking={false} label={seen ? EXPRESSION_LABELS[e] : 'Unknown expression'} />
                    <span>{seen ? EXPRESSION_LABELS[e] : '???'}</span>
                  </li>
                );
              })}
            </ul>
          </Win>

          <Win title="privacy.exe" id="privacy" className="full">
            <div className="privacy">
              <div>
                <p>
                  <strong>Everything stays on this computer.</strong> No servers, no accounts, no analytics, no AI APIs. The extension never makes a network
                  request.
                </p>
                <p>
                  It reacts to <em>that</em> you click, scroll, type or switch tabs — never <em>what</em> you click, type or read. It doesn’t read page text,
                  form fields, passwords, URLs, titles or history.
                </p>
                <p className="help">
                  Stored locally in <code>chrome.storage.local</code>: your settings, the Gremlin’s position, relationship numbers, secrets found, recently
                  used dialogue ids, and the list of sites <em>you</em> chose to hide it on.
                </p>
                <div className="btns">
                  <button className="btn small" onClick={() => void store.dump().then((d) => setDump(JSON.stringify(d, null, 2)))}>
                    View my stored data
                  </button>
                  <button className="btn small" onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/index.html') })}>
                    Replay intro
                  </button>
                  <button className="btn danger small" onClick={() => setConfirm('everything')}>
                    Reset everything
                  </button>
                </div>
              </div>
              <div>
                <h3>Hidden on these sites</h3>
                {settings.hiddenSites.length === 0 ? (
                  <p className="help">None. Use “Hide on this site” in the Gremlin’s menu.</p>
                ) : (
                  <ul className="sites">
                    {settings.hiddenSites.map((h) => (
                      <li key={h}>
                        <code>{h}</code>
                        <button className="btn small" onClick={() => set({ hiddenSites: settings.hiddenSites.filter((x) => x !== h) })}>
                          Unhide
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {dump && (
              <pre className="dump" aria-label="Your stored data">
                {dump}
              </pre>
            )}
          </Win>
        </div>
        <footer className="opt-foot">
          v{chrome.runtime.getManifest?.().version} · {LINES.length} dialogue lines ({LINE_COUNT} including thoughts & notes) · MIT licensed · 100% offline
        </footer>
      </div>

      {confirm && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <Win title="are_you_sure.exe" id="confirm">
            <div className="confirm">
              <Sprite expression="shocked" scale={3} />
              <div>
                <p>
                  {confirm === 'relationship'
                    ? `${settings.name} will forget you completely. Affection, trust and chaos go back to zero. (Secrets you found stay.)`
                    : 'All settings, position, relationship and secrets will be wiped. A brand new gremlin hatches.'}
                </p>
                <div className="btns">
                  <button className="btn" onClick={() => setConfirm(null)} autoFocus>
                    Never mind
                  </button>
                  <button className="btn danger" onClick={() => void doReset()}>
                    Yes, reset
                  </button>
                </div>
              </div>
            </div>
          </Win>
        </div>
      )}
    </div>
  );
}
