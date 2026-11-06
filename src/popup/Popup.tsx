import { useEffect, useState } from 'react';
import { MOOD_LABEL, type Mood } from '../engine/moods';
import { daysTogether, formatDuration, tierOf, TIER_NAMES } from '../engine/relationship';
import { SECRETS } from '../engine/secrets';
import type { MenuAction, TabMessage } from '../shared/types';
import { Bar, Sprite, store, Toggle, useData, useTheme } from '../ui/kit';

type TabStatus = 'checking' | 'ok' | 'unsupported' | 'hidden';

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  // `?tab=<id>` lets automated tests open the popup as a page and still target a site tab.
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  if (forced) return chrome.tabs.get(forced).catch(() => undefined);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(msg: TabMessage): Promise<boolean> {
  const tab = await activeTab();
  if (tab?.id === undefined) return false;
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
    return true;
  } catch {
    return false;
  }
}

const ACTIONS: [MenuAction, string, string][] = [
  ['pet', 'Pet', '♥'],
  ['feed', 'Feed', '◆'],
  ['play', 'Play', '▶'],
  ['mood', 'Mood dice', '⚄'],
  ['thoughts', 'Thoughts', '…'],
  ['summon', 'Summon', '✦'],
];

export function Popup() {
  const data = useData();
  useTheme(data?.settings.theme);
  const [status, setStatus] = useState<TabStatus>('checking');
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void sendToTab({ type: 'ping' }).then((ok) => setStatus(ok ? 'ok' : 'unsupported'));
  }, []);

  if (!data) return <div className="popup loading">Waking the gremlin…</div>;
  const { settings, pet } = data;
  const tier = tierOf(pet);
  const mood = (pet.mood in MOOD_LABEL ? pet.mood : 'IDLE') as Mood;

  const act = async (a: MenuAction) => {
    const ok = await sendToTab({ type: 'action', action: a });
    if (!ok) {
      setStatus('unsupported');
      return;
    }
    setFlash(a === 'feed' ? 'Snack tray opened on the page.' : a === 'play' ? 'Game started on the page!' : 'Done. Look at the page.');
    if (a === 'feed' || a === 'play' || a === 'thoughts') setTimeout(() => window.close(), 700);
    setTimeout(() => setFlash(null), 1800);
  };

  return (
    <main className="popup">
      <section className="win">
        <header className="win-title">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="grow">{settings.name}.exe</span>
          <span className="chip ghost">{MOOD_LABEL[mood]}</span>
        </header>
        <div className="pop-hero">
          <div className="pop-stage">
            <Sprite expression={pet.expression} scale={3} className="breathe" />
          </div>
          <div className="pop-id">
            <h1>{settings.name}</h1>
            <span className="chip">{TIER_NAMES[tier]}</span>
            <p className="muted">
              Day {daysTogether(pet)} · {pet.visits} visits
            </p>
          </div>
        </div>
        <div className="thought pop-thought">“{pet.thought}”</div>
        <div className="pop-bars">
          <Bar label="Affection" value={pet.affection} color="#ff4f9a" />
          <Bar label="Trust" value={pet.trust} color="#b8ff3c" />
          <Bar label="Chaos" value={pet.chaos} color="#a982ff" />
        </div>
        <div className="pop-actions">
          {ACTIONS.map(([id, label, icon]) => (
            <button key={id} className="btn small" onClick={() => void act(id)} disabled={status === 'unsupported' && id !== 'summon'}>
              <span aria-hidden="true">{icon}</span> {label}
            </button>
          ))}
        </div>
        {status === 'unsupported' && (
          <p className="pop-warn">Gremlins can’t live on browser pages like this one (or on tabs opened before install — refresh them). Try a normal website!</p>
        )}
        {flash && <p className="pop-flash">{flash}</p>}
        <div className="pop-toggles">
          <Toggle checked={settings.visible} onChange={(v) => void store.saveSettings({ visible: v })} label="Visible" />
          <Toggle checked={settings.bubbles} onChange={(v) => void store.saveSettings({ bubbles: v })} label="Speech" />
          <Toggle checked={settings.sound} onChange={(v) => void store.saveSettings({ sound: v })} label="Sound" />
        </div>
        <footer className="pop-foot">
          <span>
            {formatDuration(pet.totalTimeMs)} together · {pet.secrets.length}/{SECRETS.length} secrets
          </span>
          <button className="btn small" onClick={() => void chrome.runtime.openOptionsPage()}>
            ⚙ Settings
          </button>
        </footer>
      </section>
    </main>
  );
}
