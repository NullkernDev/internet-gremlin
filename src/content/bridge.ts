import type { TabMessage, WorkerMessage } from '../shared/types';

/** How the in-page Gremlin talks to the rest of the extension. */
export interface Bridge {
  onMessage(cb: (m: TabMessage) => void): () => void;
  openOptions(): void;
  getTabCount(): Promise<number | null>;
  hostname: string;
}

export function chromeBridge(): Bridge {
  return {
    hostname: location.hostname,
    onMessage(cb) {
      const listener = (msg: TabMessage, _s: chrome.runtime.MessageSender, respond: (r: unknown) => void) => {
        if (msg?.type === 'ping') {
          respond({ ok: true });
          return false;
        }
        cb(msg);
        respond({ ok: true });
        return false;
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    },
    openOptions() {
      void chrome.runtime.sendMessage({ type: 'openOptions' } satisfies WorkerMessage).catch(() => undefined);
    },
    async getTabCount() {
      try {
        return (await chrome.runtime.sendMessage({ type: 'getTabCount' } satisfies WorkerMessage)) as number;
      } catch {
        return null;
      }
    },
  };
}

/** A fake bridge for the promo demo page. */
export function demoBridge(): Bridge & { send(m: TabMessage): void } {
  const subs = new Set<(m: TabMessage) => void>();
  return {
    hostname: 'demo.local',
    onMessage(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    openOptions() {},
    async getTabCount() {
      return null;
    },
    send(m) {
      subs.forEach((s) => s(m));
    },
  };
}
