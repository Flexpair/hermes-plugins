import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

async function loadPlugin(mode, desktop = { zoom: { get: async () => ({ percent: 125 }), setPercent: () => {} } }, storage = new Map()) {
  let override = null
  const contributions = []
  let dispose
  const calls = []
  const root = { dataset: { hermesMode: mode } }
  const observers = new Set()
  const context = vm.createContext({
    window: { hermesDesktop: desktop },
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
    storage: {
      get: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
      set: (key, value) => storage.set(key, value),
      remove: key => storage.delete(key)
    },
    onDispose: fn => { dispose = fn },
    register: item => { contributions.push(item) },
    registerMany: items => { contributions.push(...items) }
  })
  await new Promise(resolve => setImmediate(resolve))
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

function desktopZoom(percent) {
  const zoomCalls = []
  return {
    zoomCalls,
    zoom: {
      get: async () => ({ percent }),
      setPercent: value => { percent = value; zoomCalls.push(value) }
    }
  }
}

for (const percent of [110, 135, 163]) {
  test(`disable resets to Hermes default instead of the previous ${percent} percent zoom`, async () => {
    const desktop = desktopZoom(percent)
    const storage = new Map()
    const runtime = await loadPlugin('dark', desktop, storage)
    runtime.dispose()
    // Hermes maps a non-positive percent to its own DEFAULT_ZOOM_LEVEL.
    assert.deepEqual(desktop.zoomCalls, [150, 0])
    assert.equal(runtime.override, null)
    assert.equal(runtime.observerCount, 0)
    assert.equal(storage.size, 0)
  })
}

test('restart resets to Hermes default despite stale previous-zoom storage', async () => {
  const desktop = desktopZoom(150)
  const storage = new Map([['zoom-before-enable', 135]])
  const runtime = await loadPlugin('dark', desktop, storage)
  runtime.dispose()
  assert.deepEqual(desktop.zoomCalls, [150, 0])
  assert.equal(storage.get('zoom-before-enable'), 135)
})

test('enable applies 150 percent once without locking manual zoom', async () => {
  const desktop = desktopZoom(130)
  const { zoomCalls } = desktop
  const runtime = await loadPlugin('dark', desktop)
  assert.deepEqual(zoomCalls, [150])
  desktop.zoom.setPercent(120)
  runtime.setMode('light')
  assert.deepEqual(zoomCalls, [150, 120])
  runtime.dispose()
  runtime.setMode('dark')
  assert.deepEqual(zoomCalls, [150, 120, 0])
})

for (const desktop of [undefined, {}, { zoom: {} }]) {
  test(`missing zoom bridge preserves accent behavior: ${JSON.stringify(desktop)}`, async () => {
    const runtime = await loadPlugin('light', desktop ?? null)
    assert.equal(runtime.override, '#157878')
    runtime.dispose()
    assert.equal(runtime.override, null)
  })
}

test('a throwing setter does not prevent accent initialization or cleanup', async () => {
  const runtime = await loadPlugin('dark', {
    zoom: { get: async () => ({ percent: 135 }), setPercent: () => { throw new Error('Unavailable bridge') } }
  })
  assert.equal(runtime.override, '#00FFFF')
  runtime.dispose()
  assert.equal(runtime.override, null)
  assert.equal(runtime.observerCount, 0)
})

test('a throwing reset does not prevent accent cleanup or observer disposal', async () => {
  const zoomCalls = []
  const runtime = await loadPlugin('dark', {
    zoom: { get: async () => ({ percent: 135 }), setPercent: value => {
      zoomCalls.push(value)
      if (value === 0) throw new Error('Unavailable reset')
    } }
  })
  runtime.dispose()
  assert.deepEqual(zoomCalls, [150, 0])
  assert.equal(runtime.override, null)
  assert.equal(runtime.observerCount, 0)
})

test('re-enable reapplies 150 percent and disable always resets to Hermes default', async () => {
  const desktop = desktopZoom(130)
  const { zoomCalls } = desktop
  const storage = new Map()
  const first = await loadPlugin('dark', desktop, storage)
  desktop.zoom.setPercent(120)
  first.dispose()
  desktop.zoom.setPercent(140)
  const second = await loadPlugin('dark', desktop, storage)
  assert.deepEqual(zoomCalls, [150, 120, 0, 140, 150])
  second.dispose()
  assert.deepEqual(zoomCalls, [150, 120, 0, 140, 150, 0])
})

test('zoom lifecycle does not start an asynchronous read', async () => {
  let zoomReads = 0
  const zoomCalls = []
  const runtime = await loadPlugin('dark', {
    zoom: {
      get: () => { zoomReads++; return new Promise(() => {}) },
      setPercent: value => zoomCalls.push(value)
    }
  })
  runtime.dispose()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(zoomReads, 0)
  assert.deepEqual(zoomCalls, [150, 0])
  assert.equal(runtime.override, null)
})

for (const percent of [undefined, 0, -1, NaN, Infinity, '135']) {
  test(`reset does not depend on the previous zoom value: ${String(percent)}`, async () => {
    const zoomCalls = []
    const runtime = await loadPlugin('dark', {
      zoom: { get: async () => ({ percent }), setPercent: value => zoomCalls.push(value) }
    })
    runtime.dispose()
    assert.deepEqual(zoomCalls, [150, 0])
    assert.equal(runtime.override, null)
  })
}

test('an unavailable zoom getter does not prevent enable or reset', async () => {
  const zoomCalls = []
  const runtime = await loadPlugin('dark', {
    zoom: {
      get: () => { throw new Error('must not read previous zoom') },
      setPercent: value => zoomCalls.push(value)
    }
  })
  assert.equal(runtime.override, '#00FFFF')
  runtime.dispose()
  assert.deepEqual(zoomCalls, [150, 0])
  assert.equal(runtime.observerCount, 0)
})

test('a setter-only bridge applies zoom and resets without a getter', async () => {
  const zoomCalls = []
  const runtime = await loadPlugin('dark', { zoom: { setPercent: value => zoomCalls.push(value) } })
  runtime.dispose()
  assert.deepEqual(zoomCalls, [150, 0])
  assert.equal(runtime.override, null)
})
