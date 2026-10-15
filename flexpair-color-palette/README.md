# Flexpair Color Palette — Hermes Desktop plugin

A copy of Nous Research's [Accent Picker](../accent-picker/README.md), with a separate plugin identity and Flexpair's initial accent colors. The original plugin remains unchanged; its MIT license is retained.

On enable, the plugin applies the accent for the currently rendered mode:

- Dark mode: `#00FFFF`.
- Light mode: `#157878`.

Switching between light and dark applies the corresponding initial color again. The OKLCH picker still lets you choose another color; ordinary repaints do not reset your choice. Colors are temporary, not persisted. Reset and disabling the plugin restore the active theme's original accent.

The values above are the exact accent overrides passed to Hermes. Hermes derives the rest of the palette and may adapt the painted accent for contrast, depending on the active theme.

Enable only one accent picker at a time: both this plugin and the original Accent Picker control Hermes's shared accent override.

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

`npm test` rebuilds `desktop/plugin.js` and exercises the bundled plugin with mocked SDK and React lifecycle hooks. It checks both initial colors, mode switches, manual picks, reset, and disable cleanup. This is not a visual desktop integration test.

Commit the rebuilt `desktop/plugin.js`; Hermes loads that artifact directly.

## Layout

- `desktop/plugin.js` — loadable ESM artifact.
- `src/plugin.tsx` — plugin identity, mode-specific initialization and palette commands.
- `src/picker.tsx` — original OKLCH picker.
- `test/plugin.test.mjs` — dependency-free bundled-plugin tests.
- `plugin.yaml` — Hermes plugin manifest.

## SDK

Uses the public [Hermes Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk/).

MIT.
