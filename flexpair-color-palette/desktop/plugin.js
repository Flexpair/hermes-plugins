// src/plugin.tsx
import { setAccentOverride } from "@hermes/plugin-sdk";
var plugin = {
  id: "flexpair-color-palette",
  name: "Flexpair Color Palette",
  description: "Apply fixed Flexpair accents and 150% desktop zoom on enable. No picker or color commands.",
  defaultEnabled: false,
  register(ctx) {
    const desktopWindow = window;
    const zoom = desktopWindow.hermesDesktop?.zoom;
    const setZoom = (percent) => {
      try {
        if (typeof zoom?.setPercent === "function") zoom.setPercent(percent);
      } catch {
      }
    };
    setZoom(150);
    const root = document.documentElement;
    let lastMode;
    const applyInitialAccent = () => {
      const mode = root.dataset.hermesMode;
      if (mode !== "dark" && mode !== "light" || mode === lastMode) return;
      lastMode = mode;
      setAccentOverride(mode === "dark" ? "#00FFFF" : "#157878");
    };
    const observer = new MutationObserver(applyInitialAccent);
    observer.observe(root, { attributes: true, attributeFilter: ["data-hermes-mode"] });
    applyInitialAccent();
    ctx.onDispose(() => {
      observer.disconnect();
      setAccentOverride(null);
      setZoom(0);
    });
  }
};
var plugin_default = plugin;
export {
  plugin_default as default
};
