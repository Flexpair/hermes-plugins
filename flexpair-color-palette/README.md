# Flexpair Color Palette — Hermes Desktop plugin

Derived from Nous Research's [Accent Picker](../accent-picker/README.md), with a separate plugin identity and fixed Flexpair accent colors. The picker and palette commands are removed. The original plugin remains unchanged; its MIT license is retained.

On enable, the plugin applies the accent for the currently rendered mode:

- Dark mode: `#00FFFF`.
- Light mode: `#157878`.

Switching between light and dark automatically applies the corresponding color. There is no status bar picker, manual color control, reset command or clipboard command. Disabling the plugin restores the active theme's original accent; no theme settings are persisted.

Mode tracking belongs to the plugin's enable/disable lifecycle. It observes Hermes's root `data-hermes-mode` attribute, which core updates for the actually painted mode. Repeated same-mode updates are ignored; disabling disconnects the observer. No private core imports or core changes are required.

The values above are the exact accent overrides passed to Hermes. Hermes derives the rest of the palette and may adapt the painted accent for contrast, depending on the active theme.

Do not enable the original Accent Picker alongside this plugin: both control Hermes's shared accent override.

## Install locally

From this repository's root:

```bash
hermes plugins install ./flexpair-color-palette
```

Then enable **Flexpair Color Palette** under **Capabilities → Plugins** in Hermes Desktop. This plugin is not yet listed in the official catalog.

## Build and test

```bash
npm ci
npm test
hermes plugins validate . --json
```

`npm test` rebuilds `desktop/plugin.js` and exercises the bundled plugin with mocked SDK and DOM APIs. It checks both initial colors, mode switches, absence of UI and palette commands, same-mode updates, delayed boot initialization, and observer cleanup on disable. This is not a visual desktop integration test.

Commit the rebuilt `desktop/plugin.js`; Hermes loads that artifact directly.

## Layout

- `desktop/plugin.js` — loadable ESM artifact.
- `src/plugin.tsx` — plugin identity and mode-specific accent lifecycle.
- `test/plugin.test.mjs` — dependency-free bundled-plugin tests.
- `plugin.yaml` — Hermes plugin manifest.

## SDK

Uses the public [Hermes Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk/).

MIT.
