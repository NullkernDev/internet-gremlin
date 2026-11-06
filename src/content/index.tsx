/**
 * Content script entry: mounts the Gremlin inside a shadow root so the page
 * and the Gremlin can't break each other's styles.
 */
import { createRoot, type Root } from 'react-dom/client';
import { ChromeStore } from '../shared/storage';
import { chromeBridge } from './bridge';
import { GremlinApp } from './GremlinApp';
import css from './content.css?inline';

const TAG = 'internet-gremlin';

function loadFont(): void {
  try {
    const weights: [string, string][] = [
      ['400', 'fonts/pixelify-sans-latin-400-normal.woff2'],
      ['700', 'fonts/pixelify-sans-latin-700-normal.woff2'],
    ];
    for (const [weight, file] of weights) {
      const face = new FontFace('GremlinPixel', `url(${chrome.runtime.getURL(file)})`, { weight });
      document.fonts.add(face);
      void face.load().catch(() => undefined);
    }
  } catch {
    // falls back to monospace
  }
}

function mount(): void {
  if (window.top !== window || document.querySelector(TAG)) return;
  if (!(document.documentElement instanceof HTMLElement)) return; // e.g. raw XML / SVG documents

  const host = document.createElement(TAG);
  host.setAttribute('aria-live', 'polite');
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  const container = document.createElement('div');
  shadow.appendChild(container);
  document.documentElement.appendChild(host);
  loadFont();

  const root: Root = createRoot(container);
  root.render(<GremlinApp store={new ChromeStore()} bridge={chromeBridge()} hostEl={host} />);

  // Some single-page apps wipe the <html> children. Put the Gremlin back if so.
  const observer = new MutationObserver(() => {
    if (!host.isConnected) document.documentElement.appendChild(host);
  });
  observer.observe(document.documentElement, { childList: true });

  // When the extension is reloaded or updated, this old copy loses its
  // connection to Chrome. Clean up quietly instead of throwing errors.
  const alive = setInterval(() => {
    if (!chrome.runtime?.id) {
      clearInterval(alive);
      observer.disconnect();
      root.unmount();
      host.remove();
    }
  }, 5000);
}

mount();
