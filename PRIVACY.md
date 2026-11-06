# Privacy Policy — Internet Gremlin

_Last updated: 6 November 2026_

Internet Gremlin is a browser extension that shows a small animated creature on web pages. It is designed to work **entirely on your device**.

## The short version

- No servers, no accounts, no analytics, no advertising, no AI services.
- The extension **never sends any data anywhere**. It makes no network requests.
- It notices *that* you interact with a page, never *what* you type, read or click.
- Everything it remembers is stored locally in your browser and can be viewed or deleted at any time.

## What the extension observes

While a web page is open and visible, the in-page Gremlin listens for these events so it can react:

| Event | What is used | What is **not** used |
| --- | --- | --- |
| Mouse movement | Cursor position on screen, to point the Gremlin's eyes and detect petting | The element under the cursor |
| Clicks / taps | That a click happened (and whether it was on the Gremlin) | What was clicked |
| Key presses | That *a* key was pressed, as a sign you're active (and Escape, to close its menu) | Which key, or any text |
| Scrolling | Scroll distance, to notice fast scrolling | The page content |
| Tab visibility & fullscreen | Whether its tab is visible; whether something is fullscreen | — |

The background service worker observes:

| Event | What is used | What is **not** used |
| --- | --- | --- |
| Tabs opened / closed | The **number** of open tabs | URLs, titles, favicons, content |
| Switching tabs | The timing of switches, to detect very rapid switching | Which tabs |

These observations are processed in memory, in real time, and are not recorded as a history.

The extension does **not** read page text, form fields, passwords, URLs, page titles, cookies or browsing history. It does not request the `tabs`, `history`, `cookies`, `webRequest` or `scripting` permissions.

## What is stored, and where

Data is stored with `chrome.storage.local`, which lives in your browser profile on your device. It is not synced to your Google/Microsoft account by the extension.

**`settings`** — your preferences: visibility, sound, speech bubbles, personality intensity, animation level, reduced-motion preference, theme, size, wandering, the Gremlin's name, whether onboarding was completed, and `hiddenSites`: the list of website **hostnames you explicitly chose** to hide the Gremlin on (e.g. `example.com`). Nothing is added to this list automatically.

**`position`** — where the Gremlin sits on screen (as fractions of the window size) and whether it is minimised.

**`pet`** — the Gremlin's memory of you:
- when it was created and when you last saw it;
- number of visits, interactions, snacks eaten, total time together (a duration);
- affection, trust and chaos scores (0–100), and how often you used each interaction type;
- its last mood, expression and “thought” (text from its own dialogue library);
- the secrets you discovered, expressions you have seen, golden-eye sightings, your best reaction-game time, the last milestone it celebrated, and any “grudge” counter;
- the ids of recently spoken dialogue lines (e.g. `poke.3`), so it doesn't repeat itself.

## Viewing and deleting your data

- **View:** Settings → *privacy.exe* → **View my stored data** shows the exact stored JSON.
- **Reset relationship:** Settings → *relationship.exe* → **Reset relationship**.
- **Delete everything:** Settings → *privacy.exe* → **Reset everything**, or uninstall the extension (removing an extension deletes its local storage).

## Children

The extension collects no personal information from anyone, including children.

## Changes

If this policy ever changes, the change will be recorded in this file and in the [CHANGELOG](CHANGELOG.md). Any future feature that would send data off your device would be opt-in and clearly described first.

## Contact

Questions or concerns: please [open an issue](https://github.com/NullkernDev/internet-gremlin/issues).
