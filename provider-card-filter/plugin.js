// Private presentation-only customization, not a catalog-admissible SDK plugin.
// Account rows lack provider-id hooks; this narrowly scoped DOM overlay can
// require maintenance after Desktop updates. No credentials or routing changes.
const css = "/* Presentation only: no credential or model-routing changes. */\n[id=\"provider-key-Qwen-Cloud\"],\n[id=\"provider-key-Xiaomi-MiMo\"],\n[id=\"provider-key-Tencent-TokenHub\"],\n[id=\"provider-key-Tencent-TokenPlan\"],\n[id=\"provider-key-DeepSeek\"],\n[id=\"provider-key-Z-AI-GLM-\"],\n[id=\"provider-key-Kimi-Kimi-Coding-Plan\"],\n[id=\"provider-key-Kimi-Moonshot-China-\"],\n[id=\"provider-key-StepFun-Step-Plan\"],\n[id=\"provider-key-MiniMax\"],\n[id=\"provider-key-MiniMax-China-\"],\n[id=\"provider-key-Alibaba-Cloud-DashScope-China-\"],\n[id=\"provider-key-Alibaba-Cloud-Token-Plan-\"],\n[id=\"provider-key-Alibaba-Cloud-Token-Plan-China-\"],\n[id=\"provider-key-Alibaba-Cloud-Coding-Plan-\"],\n[id=\"provider-key-Alibaba-Cloud-Coding-Plan-China-\"] {\n  display: none !important;\n}\n";
const accountTitles = new Set(['MiniMax', 'Qwen Code']);
// Match only account-row title spans, never general page text or inputs.
const rowSelector = 'section.mb-5.grid.gap-2 > [data-slot="row-button"], section.mb-5.grid.gap-2 > div.group.grid';
const marker = 'data-hermes-provider-filter';

export default {
  id: 'provider-card-filter',
  name: 'Provider Card Filter',
  description: 'Hide MiniMax and Qwen Code account rows and the confirmed Chinese-provider API-key cards. Credentials, other providers and model routing are unchanged.',
  defaultEnabled: true,
  register(ctx) {
    const style = document.createElement('style');
    style.id = 'hermes-provider-card-filter';
    style.textContent = css + '\n[data-hermes-provider-filter="account"] { display: none !important; }';
    document.head.appendChild(style);
    const marked = new Set();
    let lastCount = -1;
    const update = () => {
      const next = new Set();
      for (const row of document.querySelectorAll(rowSelector)) {
        const title = row.querySelector('[data-slot="row-button"] span.font-semibold, span.font-semibold');
        if (title && accountTitles.has(title.textContent.trim())) next.add(row);
      }
      for (const row of marked) {
        if (!next.has(row)) row.removeAttribute(marker);
      }
      for (const row of next) {
        if (!marked.has(row)) row.setAttribute(marker, 'account');
      }
      marked.clear();
      for (const row of next) marked.add(row);
      if (next.size !== lastCount) {
        lastCount = next.size;
        window.hermesDesktop?.logLine?.('[provider-card-filter] accounts-hidden=' + next.size);
      }
    };
    const observer = new MutationObserver(update);
    ctx.onDispose(() => {
      observer.disconnect();
      for (const row of marked) row.removeAttribute(marker);
      marked.clear();
      style.remove();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    update();
    window.hermesDesktop?.logLine?.('[provider-card-filter] enabled; accounts=MiniMax,Qwen Code');
  }
};
