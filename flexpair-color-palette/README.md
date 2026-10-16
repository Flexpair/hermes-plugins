# Flexpair Color Palette — Hermes Desktop plugin

Derived from Nous Research's [Accent Picker](../accent-picker/README.md), with a separate plugin identity and fixed Flexpair accent colors. The picker and palette commands are removed. The original plugin remains unchanged; its MIT license is retained.

On enable, the plugin applies the accent for the currently rendered mode:

- Dark mode: `#00FFFF`.
- Light mode: `#157878`.

Switching between light and dark automatically applies the corresponding color. There is no status bar picker, manual color control, reset command or clipboard command. Disabling the plugin restores the active theme's original accent; no theme settings are persisted.

## Desktop zoom

Each enable, app startup with the plugin enabled, or plugin reload sets the whole desktop interface to **150%**. Disabling resets to **Hermes's own default zoom**, the same level used by **View → Actual Size**. It does not restore the previous or manually selected zoom. Manual zoom shortcuts and the existing appearance setting remain available while enabled: mode switches do not reset zoom. Reloading briefly resets to the default before reapplying 150%.

This uses the existing Electron preload bridge `window.hermesDesktop.zoom.setPercent`, not CSS scaling or modifications to Hermes core. A reset passes `0`: Hermes's current `percentToZoomLevel` maps non-positive values to `DEFAULT_ZOOM_LEVEL`. No default percentage is hard-coded in the plugin. That bridge and conversion behavior are **not part of the documented plugin SDK**, so future compatibility is not guaranteed. If the bridge is unavailable or throws, accent initialization and cleanup still work.

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

`npm test` rebuilds `desktop/plugin.js` and exercises the bundled plugin with mocked SDK, DOM and desktop bridge APIs. It checks both initial colors, mode switches, absence of UI and palette commands, same-mode updates, delayed boot initialization, observer cleanup on disable, one-time 150% zoom, manual zoom preservation while enabled, reset to Hermes's default regardless of previous zoom or stale storage, re-enable, setter-only hosts, and missing or throwing bridge fallback. This is not a visual desktop integration test.

Commit the rebuilt `desktop/plugin.js`; Hermes loads that artifact directly.

## Layout

- `desktop/plugin.js` — loadable ESM artifact.
- `src/plugin.tsx` — plugin identity and mode-specific accent lifecycle.
- `test/plugin.test.mjs` — dependency-free bundled-plugin tests.
- `plugin.yaml` — Hermes plugin manifest.

## SDK

Uses the public [Hermes Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk/).

MIT.
