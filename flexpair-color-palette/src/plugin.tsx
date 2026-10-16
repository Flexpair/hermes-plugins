// Fixed Flexpair accent seeds; palette derivation remains Hermes core behavior.
import type { HermesPlugin } from '@hermes/plugin-sdk'
import { setAccentOverride } from '@hermes/plugin-sdk'

const plugin: HermesPlugin = {
  id: 'flexpair-color-palette',
  name: 'Flexpair Color Palette',
  description:
    'Apply fixed Flexpair accents and 150% desktop zoom on enable. No picker or color commands.',
  defaultEnabled: false,
  register(ctx) {
    // Use the existing Electron bridge, not private core imports or CSS scaling.
    // Zoom is not yet part of the plugin SDK; older hosts keep accent behavior.
    const desktopWindow = window as Window & {
      hermesDesktop?: { zoom?: { setPercent?: (percent: number) => void } }
    }
    const zoom = desktopWindow.hermesDesktop?.zoom
    try {
      if (typeof zoom?.setPercent === 'function') zoom.setPercent(150)
    } catch {
      // An incompatible host must not prevent the primary accent behavior.
    }

    const root = document.documentElement
    let lastMode: string | undefined
    // Core publishes the painted mode here, including boot and system changes.
    // Watch it for the plugin's lifetime; no UI contribution is needed.
    const applyInitialAccent = () => {
      const mode = root.dataset.hermesMode
      if ((mode !== 'dark' && mode !== 'light') || mode === lastMode) return
      lastMode = mode
      setAccentOverride(mode === 'dark' ? '#00FFFF' : '#157878')
    }
    const observer = new MutationObserver(applyInitialAccent)
    observer.observe(root, { attributes: true, attributeFilter: ['data-hermes-mode'] })
    applyInitialAccent()
    // Disabling or reloading restores the active theme's original accent.
    ctx.onDispose(() => {
      observer.disconnect()
      setAccentOverride(null)
    })

  }
}

export default plugin
