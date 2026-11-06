/**
 * Records the promo demo to promo/demo.mp4 and promo/demo.gif.
 *
 * How it works (Linux): starts a virtual X display (Xvfb), opens the built
 * demo page in a real, headed Chrome window in kiosk mode, captures the
 * screen with ffmpeg's x11grab at 30 fps, then trims and encodes. Finally it
 * synthesises an original soundtrack from the demo's event log
 * (scripts/soundtrack.ts) and muxes it in.
 *
 *   npm run demo:build && npm run demo:record
 *
 * Requires: Xvfb, ffmpeg (with libx264), and Chrome/Chromium (CHROME_PATH).
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { buildSoundtrack, muxSoundtrack } from './soundtrack';

const root = resolve(import.meta.dirname, '..');
const distDir = join(root, 'promo/demo/dist');
const outDir = join(root, 'promo');
const tmp = join(root, '.scratch');
const chromePath = process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const DISPLAY = ':99';
const W = 1280;
const H = 720;
const DURATION = 30;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

function serve(): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = join(distDir, path === '/' ? 'index.html' : path);
    if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () => {
      const a = server.address();
      ok({ url: `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}/`, close: () => server.close() });
    }),
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!existsSync(join(distDir, 'index.html'))) throw new Error('Run `npm run demo:build` first');
  if (!chromePath) throw new Error('Chrome not found; set CHROME_PATH');
  mkdirSync(tmp, { recursive: true });
  const raw = join(tmp, 'demo-raw.mp4');

  const xvfb: ChildProcess = spawn('Xvfb', [DISPLAY, '-screen', '0', `${W}x${H}x24`, '-nolisten', 'tcp'], { stdio: 'ignore' });
  await sleep(800);
  const site = await serve();
  const ctx = await chromium.launchPersistentContext(join(tmp, 'rec-profile'), {
    executablePath: chromePath,
    headless: false,
    viewport: null,
    env: { ...process.env, DISPLAY },
    ignoreDefaultArgs: ['--enable-automation'],
    args: [`--app=${site.url}`, '--kiosk', `--window-size=${W},${H}`, '--window-position=0,0', '--disable-infobars', '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-gpu', '--no-first-run'],
  });
  try {
    await sleep(1500);
    const page = ctx.pages().find((p) => p.url().startsWith(site.url)) ?? (await ctx.waitForEvent('page'));
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    await page.evaluate(() => document.fonts.ready);
    await sleep(1500);

    const ff = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', `${W}x${H}`, '-i', `${DISPLAY}.0`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-pix_fmt', 'yuv420p', raw],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const ffStart = Date.now();
    await sleep(1200);
    const demoStart = Date.now();
    await page.evaluate(() => void (window as unknown as { __startDemo: () => Promise<void> }).__startDemo());
    await page.waitForFunction(() => document.body.dataset.done === '1', null, { timeout: 60_000 });
    const events = await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events);
    await sleep(400);
    ff.stdin?.write('q');
    await new Promise((r) => ff.on('close', r));

    // ffmpeg needs a moment to grab its first frame; measured offset is approximate.
    const offset = Math.max(0, (demoStart - ffStart) / 1000 - 0.45);
    const mp4 = join(outDir, 'demo.mp4');
    const silent = join(tmp, 'demo-silent.mp4');
    const enc = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-ss', offset.toFixed(2), '-i', raw, '-t', String(DURATION), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', silent],
      { stdio: 'inherit' },
    );
    if (enc.status !== 0) throw new Error('mp4 encode failed');

    // Find the exact video time of the first story beat (the mock browser starting
    // to fade in) so the soundtrack can be synced frame-accurately.
    const stats = spawnSync('ffmpeg', ['-hide_banner', '-i', silent, '-t', '3', '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'], { encoding: 'utf8' });
    const yavg = [...stats.stderr.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
    const first = yavg.findIndex((y) => Math.abs(y - yavg[0]) > 0.6);
    const videoOffset = Math.max(0, (first < 0 ? 0 : first - 1) / 30);
    writeFileSync(join(root, 'promo/demo/events.json'), JSON.stringify({ videoOffset, events }, null, 1));

    // Original chiptune soundtrack + SFX, synthesised from the event log.
    const wav = buildSoundtrack();
    copyFileSync(silent, mp4);
    muxSoundtrack(wav, mp4);

    const gif = join(outDir, 'demo.gif');
    const g = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        silent,
        '-vf',
        'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
        gif,
      ],
      { stdio: 'inherit' },
    );
    if (g.status !== 0) throw new Error('gif encode failed');
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '28.5', '-i', mp4, '-frames:v', '1', join(outDir, 'demo-poster.png')], { stdio: 'inherit' });

    console.log(`✔ promo/demo.mp4 (${(statSync(mp4).size / 1e6).toFixed(1)} MB), promo/demo.gif (${(statSync(gif).size / 1e6).toFixed(1)} MB)`);
  } finally {
    await ctx.close();
    site.close();
    xvfb.kill();
  }
}

main().catch((e) => {
  console.error('✖ recording failed:', e);
  process.exit(1);
});
