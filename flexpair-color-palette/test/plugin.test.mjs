import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

async function loadPlugin(mode) {
  let override = null
  let renderedMode = mode
  let previousDependencies
  let contributions
  let dispose
  const calls = []
  const context = vm.createContext({ navigator: { clipboard: { writeText: async () => {} } } })
  const setAccentOverride = color => { override = color; calls.push(color) }
  const sdk = {
    $accentOverride: { get: () => override },
    PALETTE_AREA: 'palette', STATUSBAR_AREAS: { right: 'right' },
    setAccentOverride, useTheme: () => ({ renderedMode }),
    contrastRatio: () => 1, hexToOklch: () => null, maxChroma: () => 0,
    oklchToHex: () => '', oklchToSrgb255: () => null,
    Popover: () => null, PopoverContent: () => null, PopoverTrigger: () => null,
    useValue: () => override
  }
  const react = {
    useEffect: (effect, dependencies) => {
      if (!previousDependencies || dependencies.some((value, i) => value !== previousDependencies[i])) {
        previousDependencies = dependencies
        effect()
      }
    },
    useCallback: value => value, useMemo: fn => fn(),
    useRef: value => ({ current: value }), useState: value => [value, () => {}]
  }
  const jsx = (type, props) => ({ type, props })
  const modules = new Map(Object.entries({
    '@hermes/plugin-sdk': sdk, react, 'react/jsx-runtime': { jsx, jsxs: jsx }
  }).map(([name, exports]) => [name, new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
  }, { context })]))
  const source = await readFile(new URL('../desktop/plugin.js', import.meta.url), 'utf8')
  const module = new vm.SourceTextModule(source, { context })
  await module.link(name => {
    assert.ok(modules.has(name), `Unexpected import: ${name}`)
    return modules.get(name)
  })
  await module.evaluate()
  const plugin = module.namespace.default
  plugin.register({ onDispose: fn => { dispose = fn }, registerMany: items => { contributions = items } })
  const render = () => {
    const element = contributions.find(item => item.id === 'picker').render()
    element.type(element.props)
  }
  return {
    plugin, calls, contributions, render, dispose,
    get override() { return override },
    setMode: value => { renderedMode = value },
    pick: setAccentOverride
  }
}

for (const [mode, expected] of [['dark', '#00FFFF'], ['light', '#157878']]) {
  test(`enable in ${mode} initializes ${expected}`, async () => {
    const runtime = await loadPlugin(mode)
    assert.equal(runtime.plugin.id, 'flexpair-color-palette')
    assert.equal(runtime.plugin.defaultEnabled, false)
    assert.equal(runtime.override, null)
    runtime.render()
    assert.equal(runtime.override, expected)
  })
}

test('mode switches select the corresponding initial color', async () => {
  const runtime = await loadPlugin('dark')
  runtime.render()
  runtime.setMode('light')
  runtime.render()
  assert.equal(runtime.override, '#157878')
  runtime.setMode('dark')
  runtime.render()
  assert.equal(runtime.override, '#00FFFF')
})

test('manual picks and reset survive same-mode repaint; disable clears override', async () => {
  const runtime = await loadPlugin('dark')
  runtime.render()
  runtime.pick('#123456')
  runtime.render()
  assert.equal(runtime.override, '#123456')
  runtime.contributions.find(item => item.id === 'reset').data.run()
  runtime.render()
  assert.equal(runtime.override, null)
  runtime.pick('#ABCDEF')
  runtime.dispose()
  assert.equal(runtime.override, null)
})
