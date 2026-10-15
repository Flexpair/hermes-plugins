import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

async function loadPlugin(mode) {
  let override = null
  const contributions = []
  let dispose
  const calls = []
  const root = { dataset: { hermesMode: mode } }
  const observers = new Set()
  const context = vm.createContext({
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
  const sdk = { setAccentOverride }
  const modules = new Map(Object.entries({
    '@hermes/plugin-sdk': sdk
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
  plugin.register({
    onDispose: fn => { dispose = fn },
    register: item => { contributions.push(item) },
    registerMany: items => { contributions.push(...items) }
  })
  return {
    plugin, calls, contributions, dispose,
    get override() { return override },
    setMode: value => {
      root.dataset.hermesMode = value
      for (const observer of observers) observer.callback()
    },
    get observerCount() { return observers.size }
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

test('mode switches select the corresponding fixed color', async () => {
  const runtime = await loadPlugin('dark')
  runtime.setMode('light')
  assert.equal(runtime.override, '#157878')
  runtime.setMode('dark')
  assert.equal(runtime.override, '#00FFFF')
})

test('registers no picker or palette commands', async () => {
  const runtime = await loadPlugin('dark')
  assert.deepEqual(runtime.contributions, [])
})

test('same-mode notifications do not reapply the accent', async () => {
  const runtime = await loadPlugin('dark')
  const calls = runtime.calls.length
  runtime.setMode('dark')
  assert.equal(runtime.override, '#00FFFF')
  assert.equal(runtime.calls.length, calls)
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
