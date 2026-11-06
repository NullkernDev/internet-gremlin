# Contributing to Internet Gremlin

Thanks for wanting to help the Gremlin grow! Small contributions are just as welcome as big ones — a single funny dialogue line counts.

## Ground rules

1. **Privacy is non-negotiable.** No network requests, analytics, remote code, or reading page content / form fields / URLs. If a feature needs any of that, it doesn't belong here.
2. **Don't be annoying.** New reactions need a cooldown and/or a probability. The Gremlin should feel alive, not twitchy.
3. **Stay on-model.** Art comes from `src/sprite/` — please extend the renderer rather than adding raster images.
4. **Be kind.** See the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

```bash
npm install
npm run check      # typecheck + lint + unit tests + build
```

Load `dist/` in `chrome://extensions` (Developer mode → Load unpacked). After rebuilding, click ↻ on the extension card and refresh your test tab.

For the end-to-end test you need Chromium or Chrome for Testing (`CHROME_PATH=/path/to/chrome npm run test:e2e`).

## Good first contributions

### Add dialogue
Open `src/engine/dialogue.ts` and add a line to the right event. Options:

```ts
['Your new line.', { r: 'u', min: 2, mood: ['HAPPY'] }],
```

- `r`: rarity — `c` common (default), `u` uncommon, `r` rare, `l` legendary
- `min` / `max`: relationship tier (0 Stranger, 1 Acquaintance, 2 Friend, 3 Bestie)
- `mood`: only say it in these moods
- Placeholders: `{name}`, `{tabs}`, `{hours}`, `{mins}`, `{days}`, `{visits}`, `{ms}`, `{time}`

Keep lines short (they live in a tiny bubble), original, and kind-hearted at the core — grumpy is fine, mean is not.

### Add a secret
1. Add it to `src/engine/secrets.ts` (id, name, description, hint).
2. Trigger it from `src/engine/brain.ts` with `this.secret('your-id')`.
3. Add a unit test in `tests/brain.test.ts` if it can be triggered deterministically.

### Add an expression
1. Add the name to `EXPRESSIONS` in `src/sprite/sprite.ts` and a definition in `DEFS` (eyes, mouth, extras, optional tint/arms).
2. Run `npx tsx scripts/sheet.ts /tmp/sheet.svg` to preview every expression on one sheet.
3. Optionally map it to a mood in `src/engine/moods.ts`.

## Pull requests

- One topic per PR; describe what changed and how you tested it.
- `npm run check` must pass. If you touched the in-page UI, run `npm run test:e2e` too.
- Update `CHANGELOG.md` under an “Unreleased” heading.
- Screenshots or a short GIF are hugely appreciated for visual changes.

## Reporting bugs

[Open an issue](https://github.com/NullkernDev/internet-gremlin/issues/new/choose) and please include: browser and version, operating system, what you did, what you expected, what happened, and any errors from `chrome://extensions` (click **Errors** on the Internet Gremlin card). Please do **not** include personal data or the URLs of private pages.

## Code style

TypeScript strict mode, React function components, Prettier-style formatting (2 spaces, single quotes, 160 columns). ESLint is the source of truth: `npm run lint`.

## Releasing (maintainers)

1. Move the “Unreleased” notes in `CHANGELOG.md` under a new version heading.
2. Bump `version` in `package.json` (the manifest version is filled in at build time).
3. Merge to `main`. The **Release** workflow tests and builds the extension, creates the `vX.Y.Z` tag and publishes the GitHub release with the zip and demo video attached.

