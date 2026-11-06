/**
 * End-to-end test: loads the built extension (dist/) into a real Chromium
 * browser with Playwright and checks it on an ordinary website.
 *
 *   npm run test:e2e
 *
 * Needs a Chromium-based browser that still supports --load-extension
 * (Chromium or Chrome for Testing). Set CHROME_PATH if it isn't found.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const shots = process.env.SHOTS_DIR;
const chromePath =
  process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));

let passed = 0;
async function step(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  • ${name} … `);
  await fn();
  passed++;
  console.log('ok');
}

function serve(): Promise<{ url: string; close: () => void }> {
  const html = readFileSync(join(root, 'tests/fixtures/site/index.html'));
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      ok({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    }),
  );
}

async function gremlinBox(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('internet-gremlin');
    const sprite = host?.shadowRoot?.querySelector('.ig-sprite');
    if (!sprite) return null;
    const r = sprite.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

async function shadowText(page: Page, selector: string) {
  return page.evaluate((sel) => document.querySelector('internet-gremlin')?.shadowRoot?.querySelector(sel)?.textContent ?? null, selector);
}

// chrome.storage isn't visible from web pages, so read it through the service worker.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sw: any;
async function storage(_page?: Page) {
  return sw.evaluate(() => chrome.storage.local.get(null));
}

async function main() {
  assert.ok(existsSync(join(dist, 'manifest.json')), 'Run `npm run build` first');
  assert.ok(chromePath, 'No Chromium-based browser found; set CHROME_PATH');
  const site = await serve();
  const userData = mkdtempSync(join(tmpdir(), 'gremlin-e2e-'));
  const external: string[] = [];
  const consoleErrors: string[] = [];

  const ctx: BrowserContext = await chromium.launchPersistentContext(userData, {
    executablePath: chromePath,
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--no-first-run', '--no-default-browser-check'],
  });
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('chrome-extension://') && !u.startsWith(site.url) && !u.startsWith('data:') && !u.startsWith('chrome://')) external.push(u);
  });

  try {
    let [worker] = ctx.serviceWorkers();
    worker ??= await ctx.waitForEvent('serviceworker', { timeout: 15_000 });
    sw = worker;
    const extId = worker.url().split('/')[2];
    const ext = (p: string) => `chrome-extension://${extId}/${p}`;
    console.log(`extension id ${extId}`);

    await step('onboarding opens on first install', async () => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && !ctx.pages().some((p) => p.url().includes('onboarding'))) await new Promise((r) => setTimeout(r, 200));
      assert.ok(ctx.pages().some((p) => p.url().includes('onboarding/index.html')));
    });

    const onb = ctx.pages().find((p) => p.url().includes('onboarding'))!;
    await step('onboarding: hatch, name, personality, finish', async () => {
      await onb.getByRole('button', { name: 'Hatch the egg' }).click();
      await onb.getByRole('button', { name: 'Hello…?' }).click();
      if (shots) await onb.screenshot({ path: join(shots, 'onboarding-name.png') });
      await onb.getByLabel('Gremlin name').fill('Bitsy');
      await onb.getByRole('button', { name: 'Next' }).click();
      if (shots) await onb.screenshot({ path: join(shots, 'onboarding-controls.png') });
      await onb.getByRole('button', { name: 'Next' }).click();
      await onb.getByRole('radio', { name: /Unhinged/ }).click();
      if (shots) await onb.screenshot({ path: join(shots, 'onboarding-personality.png') });
      await onb.getByRole('button', { name: 'Next' }).click();
      if (shots) await onb.screenshot({ path: join(shots, 'onboarding-privacy.png') });
      await onb.getByRole('button', { name: 'Release the gremlin' }).click();
      await onb.getByText('Go browse.').waitFor();
      const s = await storage(onb);
      assert.equal(s.settings.name, 'Bitsy');
      assert.equal(s.settings.intensity, 'unhinged');
      assert.equal(s.settings.onboarded, true);
      // back to normal intensity for predictable tests
      await onb.evaluate(async () => {
        const { settings } = (await chrome.storage.local.get('settings')) as { settings: Record<string, unknown> };
        await chrome.storage.local.set({ settings: { ...settings, intensity: 'normal' } });
      });
    });

    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await step('content script mounts the Gremlin on an ordinary website', async () => {
      await page.goto(site.url);
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-sprite svg'), null, { timeout: 10_000 });
      const box = await gremlinBox(page);
      assert.ok(box && box.w === 72 && box.h === 64, `unexpected size ${JSON.stringify(box)}`);
    });

    await step('it greets the owner with a speech bubble', async () => {
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-bubble'), null, { timeout: 8000 });
      const txt = await shadowText(page, '.ig-bubble-ghost');
      assert.ok(txt && txt.length > 1);
      if (shots) {
        await page.waitForTimeout(1200);
        await page.screenshot({ path: join(shots, 'in-page-greeting.png') });
      }
    });

    await step('the overlay does not block the page (clicks pass through)', async () => {
      // A point inside the overlay root but outside the sprite must hit the page
      const hit = await page.evaluate(() => {
        const el = document.elementFromPoint(640, 400);
        return el?.tagName.toLowerCase();
      });
      assert.notEqual(hit, 'internet-gremlin');
      await page.click('#signup');
      assert.equal(await page.textContent('#signup-status'), 'Subscribed!');
      await page.click('#corner-btn');
      assert.equal(await page.textContent('#corner-btn'), 'Clicked 1');
      await page.fill('#email', 'secret@example.com');
      const s = JSON.stringify(await storage(page));
      assert.ok(!s.includes('secret@example.com'), 'typed text must never be stored');
    });

    await step('poking the Gremlin triggers a reaction', async () => {
      const box = (await gremlinBox(page))!;
      await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('[class*="shot-"]'), null, { timeout: 4000 });
      await page.waitForTimeout(500);
      const s = await storage(page);
      assert.ok(s.pet.interactions >= 1, 'interaction should be counted');
      assert.ok(s.pet.favorites.poke >= 1);
    });

    await step('right-click opens the menu; thoughts work', async () => {
      const box = (await gremlinBox(page))!;
      await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2, { button: 'right' });
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-menu'));
      if (shots) {
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(shots, 'in-page-menu.png') });
      }
      await page.evaluate(() => {
        const btn = [...(document.querySelector('internet-gremlin')!.shadowRoot!.querySelectorAll('.ig-menu-btn') as NodeListOf<HTMLButtonElement>)].find(
          (b) => b.textContent?.includes('Thoughts'),
        );
        btn!.click();
      });
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-bubble.thought'));
    });

    await step('feeding from the snack tray', async () => {
      const box = (await gremlinBox(page))!;
      await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2, { button: 'right' });
      await page.evaluate(() => {
        const sr = document.querySelector('internet-gremlin')!.shadowRoot!;
        [...(sr.querySelectorAll('.ig-menu-btn') as NodeListOf<HTMLButtonElement>)].find((b) => b.textContent?.includes('Feed'))!.click();
      });
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-tray'));
      if (shots) {
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(shots, 'in-page-snacks.png') });
      }
      await page.evaluate(() => (document.querySelector('internet-gremlin')!.shadowRoot!.querySelector('.ig-snack') as HTMLButtonElement).click());
      await page.waitForTimeout(600);
      const s = await storage(page);
      assert.ok(s.pet.snacksEaten >= 1);
    });

    await step('rubbing the cursor over it counts as petting', async () => {
      await page.waitForTimeout(1600);
      const box = (await gremlinBox(page))!;
      const cy = box.y + box.h / 2;
      await page.mouse.move(box.x + 10, cy);
      for (let i = 0; i < 6; i++) {
        await page.mouse.move(box.x + box.w - 10, cy, { steps: 4 });
        await page.mouse.move(box.x + 10, cy, { steps: 4 });
      }
      await page.waitForTimeout(400);
      const s = await storage(page);
      assert.ok(s.pet.favorites.pet >= 1, 'pet gesture should register');
    });

    await step('dragging moves it and the position persists across reloads', async () => {
      const box = (await gremlinBox(page))!;
      await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
      await page.mouse.down();
      await page.mouse.move(400, 300, { steps: 12 });
      await page.mouse.move(300, 250, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      const after = (await gremlinBox(page))!;
      assert.ok(Math.abs(after.x - (300 - box.w / 2)) < 30, `drag landed at ${after.x}`);
      await page.reload();
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-sprite svg'));
      await page.waitForTimeout(300);
      const reloaded = (await gremlinBox(page))!;
      assert.ok(Math.abs(reloaded.x - after.x) < 4 && Math.abs(reloaded.y - after.y) < 4, 'position should persist');
    });

    await step('popup renders state and actions', async () => {
      await page.bringToFront();
      const siteTab = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id);
      const popup = await ctx.newPage();
      await popup.setViewportSize({ width: 380, height: 640 });
      await popup.goto(ext(`popup/index.html?tab=${siteTab}`));
      await popup.getByRole('heading', { name: 'Bitsy' }).waitFor();
      await popup.waitForTimeout(500);
      assert.equal(await popup.locator('.pop-warn').count(), 0, 'popup should reach the Gremlin on the site tab');
      await popup.getByRole('button', { name: /Thoughts/ }).click();
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-bubble.thought'), null, { timeout: 4000 });
      assert.equal(await popup.getByRole('meter').count(), 3);
      if (shots) await popup.screenshot({ path: join(shots, 'popup.png'), clip: { x: 0, y: 0, width: 360, height: 610 } });
      await popup.close();
    });

    await step('options page: visibility, size, reduced motion and theme all apply live', async () => {
      const opts = await ctx.newPage();
      await opts.goto(ext('options/index.html'));
      await opts.getByText('settings.exe').waitFor();
      if (shots) {
        await opts.setViewportSize({ width: 1280, height: 1500 });
        await opts.screenshot({ path: join(shots, 'options.png'), fullPage: true });
      }
      await opts.getByRole('switch', { name: 'Visible on pages' }).click();
      await page.bringToFront();
      await page.waitForFunction(() => !document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-sprite'), null, { timeout: 4000 });
      await opts.getByRole('switch', { name: 'Visible on pages' }).click();
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-sprite'), null, { timeout: 4000 });
      await opts.getByRole('button', { name: 'Chonky' }).click();
      await page.waitForFunction(() => {
        const r = document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-sprite')?.getBoundingClientRect();
        return r?.width === 144;
      });
      await opts.getByRole('button', { name: 'Compact' }).click();
      await opts.getByRole('group', { name: 'Reduced motion' }).getByRole('button', { name: 'On', exact: true }).click();
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-root[data-motion="reduced"]'));
      await opts.getByRole('group', { name: 'Reduced motion' }).getByRole('button', { name: 'Follow system' }).click();
      await opts.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Dark' }).click();
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-root[data-theme="dark"]'));
      await opts.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await opts.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Auto' }).click();
      await opts.close();
    });

    await step('minimize and restore', async () => {
      const box = (await gremlinBox(page))!;
      await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2, { button: 'right' });
      await page.evaluate(() => {
        const sr = document.querySelector('internet-gremlin')!.shadowRoot!;
        [...(sr.querySelectorAll('.ig-menu-btn') as NodeListOf<HTMLButtonElement>)].find((b) => b.textContent?.includes('Minimize'))!.click();
      });
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-peek'), null, { timeout: 4000 });
      await page.evaluate(() => (document.querySelector('internet-gremlin')!.shadowRoot!.querySelector('.ig-peek') as HTMLButtonElement).click());
      await page.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-sprite'), null, { timeout: 4000 });
    });

    await step('tab counting: lots of tabs make it confused', async () => {
      await page.waitForTimeout(2500); // let the previous mood settle
      const extra: Page[] = [];
      for (let i = 0; i < 9; i++) extra.push(await ctx.newPage());
      await page.bringToFront();
      const tabs = await sw.evaluate(async () => (await chrome.tabs.query({})).length);
      assert.ok(tabs >= 10, `expected ≥10 tabs, saw ${tabs}`);
      const deadline = Date.now() + 6000;
      let seen: string[] = [];
      while (Date.now() < deadline) {
        seen = (await storage()).pet.seen;
        if (seen.includes('confused')) break;
        await page.waitForTimeout(250);
      }
      assert.ok(seen.includes('confused'), `Gremlin should react to ${tabs} tabs`);
      if (shots) await page.screenshot({ path: join(shots, 'in-page-tabs.png') });
      for (const p of extra) await p.close();
    });

    await step('tab tornado: rapid tab switching makes it dizzy', async () => {
      const other = await ctx.newPage();
      await other.goto(site.url);
      await other.waitForFunction(() => !!document.querySelector('internet-gremlin')?.shadowRoot?.querySelector('.ig-sprite svg'));
      await sw.evaluate(() => {
        const g = globalThis as unknown as { __acts: number };
        g.__acts = 0;
        chrome.tabs.onActivated.addListener(() => g.__acts++);
      });
      for (let i = 0; i < 4; i++) {
        await page.bringToFront();
        await page.waitForTimeout(120);
        await other.bringToFront();
        await page.waitForTimeout(120);
      }
      await page.bringToFront();
      const deadline = Date.now() + 5000;
      let secrets: string[] = [];
      while (Date.now() < deadline) {
        secrets = (await storage()).pet.secrets;
        if (secrets.includes('tornado')) break;
        await page.waitForTimeout(200);
      }
      const acts = await sw.evaluate(() => (globalThis as unknown as { __acts: number }).__acts);
      assert.ok(secrets.includes('tornado'), `tab tornado should be detected (${acts} activations seen)`);
      await other.close();
    });

    await step('no console errors from the extension', async () => {
      const ours = consoleErrors.filter((e) => !e.includes('favicon'));
      assert.deepEqual(ours, []);
    });

    await step('no network requests leave the machine', async () => {
      assert.deepEqual(external, []);
    });

    if (shots) {
      // a nice in-page shot with the gremlin near the article
      await sw.evaluate(async () => {
        await chrome.storage.local.set({ position: { x: 0.6, y: 0.55, minimized: false } });
      });
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(shots, 'in-page.png') });
    }
  } finally {
    await ctx.close();
    site.close();
  }
  console.log(`\n✔ ${passed} end-to-end checks passed`);
}

if (shots) mkdirSync(shots, { recursive: true });
main().catch((e) => {
  console.error('\n✖ e2e failed:', e);
  process.exit(1);
});
