/**
 * Background service worker.
 *
 * It only does three things:
 *  1. Opens the onboarding page on first install.
 *  2. Counts open tabs (a number — never URLs or titles) and tells the
 *     visible Gremlin when it changes.
 *  3. Notices very rapid tab switching ("tab tornado").
 *
 * No network requests, no history, no page content. The `tabs` permission is
 * NOT requested, so Chrome doesn't even give this worker tab URLs or titles.
 */
import type { TabMessage, WorkerMessage } from '../shared/types';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/index.html') });
  }
});

async function send(tabId: number | undefined, msg: TabMessage): Promise<boolean> {
  if (tabId === undefined) return false;
  try {
    await chrome.tabs.sendMessage(tabId, msg);
    return true;
  } catch {
    // The active tab has no Gremlin (chrome:// pages, the Web Store, PDFs…). That's fine.
    return false;
  }
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

let countTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleCount(): void {
  clearTimeout(countTimer);
  countTimer = setTimeout(async () => {
    const tabs = await chrome.tabs.query({});
    await send(await activeTabId(), { type: 'tabs', count: tabs.length });
  }, 600);
}

chrome.tabs.onCreated.addListener(scheduleCount);
chrome.tabs.onRemoved.addListener(scheduleCount);

// Tab tornado: 6+ tab switches within 5 seconds.
let switches: number[] = [];
let lastStorm = 0;
chrome.tabs.onActivated.addListener(({ tabId }) => {
  scheduleCount(); // the newly visible Gremlin gets the current count
  const now = Date.now();
  switches = [...switches.filter((t) => now - t < 5000), now];
  if (switches.length >= 6 && now - lastStorm > 30_000) {
    switches = [];
    // Give the newly visible tab's Gremlin a moment to wake up. The cooldown only
    // starts if a Gremlin actually received it (blank/new tabs don't have one).
    setTimeout(async () => {
      if (await send(tabId, { type: 'tabStorm' })) lastStorm = Date.now();
    }, 350);
  }
});

chrome.runtime.onMessage.addListener((msg: WorkerMessage, _sender, sendResponse) => {
  if (msg.type === 'openOptions') {
    void chrome.runtime.openOptionsPage();
    return false;
  }
  if (msg.type === 'getTabCount') {
    void chrome.tabs.query({}).then((tabs) => sendResponse(tabs.length));
    return true; // async response
  }
  return false;
});
