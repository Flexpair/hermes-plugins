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
  const root = { dataset: { hermesMode: mode } }
  const observers = new Set()
  const context = vm.createContext({
    navigator: { clipboard: { writeText: async () => {} } },
    document: { documentElement: root },
    MutationObserver: class {
      constructor(callback) { this.callback = callback }
      observe(target, options) {
        assert.equal(target, root)
        assert.equal(options.attributes, true)
        assert.deepEqual(Array.from(options.attributeFilter), ['data-hermes-mode'])
        observers.add(this)
      }
      disconnect() { observers.delete(this) }
    }
  })
  const setAccentOverride = color => { override = color; calls.push(color) }
  const sdk = {
    $accentOverride: { get: () => override },
    PALETTE_AREA: 'palette', STATUSBAR_AREAS: { right: 'right' },
    setAccentOverride, useTheme: () => ({ renderedMode, theme: { colors: { primary: override } } }),
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
    setMode: value => {
      renderedMode = value
      root.dataset.hermesMode = value
      for (const observer of observers) observer.callback()
    },
    remount: () => { previousDependencies = undefined; render() },
    get observerCount() { return observers.size },
    pick: setAccentOverride
  }
}

for (const [mode, expected] of [['dark', '#00FFFF'], ['light', '#157878']]) {
  test(`enable in ${mode} initializes ${expected}`, async () => {
    const runtime = await loadPlugin(mode)
    assert.equal(runtime.plugin.id, 'flexpair-color-palette')
    assert.equal(runtime.plugin.defaultEnabled, false)
    assert.equal(runtime.override, expected)
  })
}

test('mode switches select the corresponding initial color without mounting the picker', async () => {
  const runtime = await loadPlugin('dark')
  runtime.setMode('light')
  assert.equal(runtime.override, '#157878')
  runtime.setMode('dark')
  assert.equal(runtime.override, '#00FFFF')
})

test('manual picks and reset survive same-mode repaint; disable clears override', async () => {
  const runtime = await loadPlugin('dark')
  runtime.render()
  runtime.pick('#123456')
  runtime.remount()
  assert.equal(runtime.override, '#123456')
  runtime.contributions.find(item => item.id === 'reset').data.run()
  runtime.remount()
  assert.equal(runtime.override, null)
  runtime.pick('#ABCDEF')
  runtime.dispose()
  assert.equal(runtime.override, null)
})

test('same-mode notifications preserve manual picks and reset', async () => {
  const runtime = await loadPlugin('dark')
  runtime.pick('#123456')
  runtime.setMode('dark')
  assert.equal(runtime.override, '#123456')
  runtime.contributions.find(item => item.id === 'reset').data.run()
  runtime.setMode('dark')
  assert.equal(runtime.override, null)
})

test('disable disconnects mode tracking and cannot reapply the accent', async () => {
  const runtime = await loadPlugin('dark')
  assert.equal(runtime.observerCount, 1)
  runtime.dispose()
  assert.equal(runtime.observerCount, 0)
  const calls = runtime.calls.length
  runtime.setMode('light')
  assert.equal(runtime.override, null)
  assert.equal(runtime.calls.length, calls)
})

test('initialization waits for a valid painted mode', async () => {
  const runtime = await loadPlugin(undefined)
  assert.equal(runtime.override, null)
  runtime.setMode('system')
  assert.equal(runtime.override, null)
  runtime.setMode('light')
  assert.equal(runtime.override, '#157878')
})
