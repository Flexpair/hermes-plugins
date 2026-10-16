# Provider Card Filter

Flexpair-maintained, presentation-only customization for Hermes Desktop. It hides
selected Chinese-company provider entries without uninstalling anything or
changing credentials, configuration, model routing or the active color palette.

This directory versions the existing local filter alongside
[Flexpair Color Palette](../flexpair-color-palette/). It is **not** an official
Nous catalog entry or a catalog-admissible SDK plugin. Its direct DOM access is a
private customization and fails the catalog's desktop-surface lint. It therefore
has its own browser-test workflow instead of entering the Python plugin matrix.

## Current scope

- API-key cards: Qwen Cloud, Xiaomi MiMo, Tencent TokenHub, Tencent TokenPlan,
  DeepSeek, Z.AI (GLM), Kimi / Kimi Coding Plan, Kimi / Moonshot (China),
  StepFun Step Plan, MiniMax, MiniMax (China), Alibaba Cloud DashScope (China),
  Alibaba Cloud (Token Plan), Alibaba Cloud (Token Plan, China),
  Alibaba Cloud (Coding Plan), Alibaba Cloud (Coding Plan, China).
- Account rows: **MiniMax** and **Qwen Code**, both disconnected rows and connected
  rows including their Remove buttons.
- Skill rows: **page-agent**, **siyuan** and **yuanbao** in the local Skills list
  and its official catalog list, including Install and Toggle controls.
- Messenger rows: **DingTalk**, **Feishu / Lark**, **WeCom (group bot)**,
  **WeCom (app)**, **Weixin / WeChat (Personal)**, **QQ Bot** and **Yuanbao (元宝)**,
  whether enabled or disabled.
- Model pickers, onboarding, CLI, external skill-hub searches and gateway behavior
  are not filtered by this version. Detail panels and chat text remain unchanged.

The selection uses company affiliation, not the language of an entry or a
person's nationality. Neutral skills are not hidden merely because their text
mentions Qwen or DeepSeek. Multi-provider services such as OpenRouter, NVIDIA and
NovitaAI remain visible. This is a UI preference, **not** a network, authorization
or compliance boundary; hidden providers can still be used through other paths.

## Installation

From this directory, install the plain-JavaScript entrypoint into the active
profile's desktop-plugin folder:

```sh
plugin_dir="${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/provider-card-filter"
mkdir -p "$plugin_dir"
cp plugin.js "$plugin_dir/plugin.js"
```

Hermes Desktop watches this folder and normally hot-reloads the file. The plugin
is enabled by default. Disable **Provider Card Filter** in Settings → Plugins to
remove its stylesheet and row markers. Existing credentials remain untouched.
This private overlay is not installed with `hermes plugins install`.

## Verification

Node.js 22 or later and Playwright Chromium are needed for the tests:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
```

The suite loads the actual `plugin.js` into Chromium with fixed DOM fixtures. It
checks target and neutral-provider visibility, connected-account Remove buttons,
local and official-catalog skill rows, messenger rows, late-rendered rows, title
and class changes, row reinsertion, active Skills-tab scope, visible ancestors,
unchanged accent, disposal, re-registration and observer cleanup. Test fixtures
contain no user credentials.

CI runs the same suite on Linux, macOS and Windows. These tests do not claim
verification in the user's active app or compatibility with every future Hermes
release. The committed lockfile pins the test dependency tree.

## Maintenance

API-key cards are matched by exact `provider-key-*` element IDs. Account rows lack
provider-ID hooks, so their matching uses the current account-section shape and
exact title spans (`MiniMax`, `Qwen Code`). Skills use the active `tab-skills`
tour marker and the list-row shape; the wide tab row remains in the DOM even
when the narrow layout displays a dropdown. Messengers use the current platform
list shape and exact names from the core messaging catalog. Only individual rows
are hidden, including their action controls; list containers remain visible.

Labels and layout classes are private implementation details; localization,
reused layout shapes or a Hermes update can change the behavior. Recheck both
disconnected and connected accounts, Skills lists and messenger lists against
the target Desktop version after updates. Do not replace these selectors with
broad substring or ancestor matching.

No Hermes core, ASAR, preload or palette files are patched. No backend calls,
account removal, deinstallation or credential reads are performed.
