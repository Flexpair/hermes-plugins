// Private presentation-only customization, not a catalog-admissible SDK plugin.
// List rows lack stable entry-ID hooks; this narrowly scoped DOM overlay can
// require maintenance after Desktop updates. No credentials or routing changes.
const css = "/* Presentation only: no credential or model-routing changes. */\n[id=\"provider-key-Qwen-Cloud\"],\n[id=\"provider-key-Xiaomi-MiMo\"],\n[id=\"provider-key-Tencent-TokenHub\"],\n[id=\"provider-key-Tencent-TokenPlan\"],\n[id=\"provider-key-DeepSeek\"],\n[id=\"provider-key-Z-AI-GLM-\"],\n[id=\"provider-key-Kimi-Kimi-Coding-Plan\"],\n[id=\"provider-key-Kimi-Moonshot-China-\"],\n[id=\"provider-key-StepFun-Step-Plan\"],\n[id=\"provider-key-MiniMax\"],\n[id=\"provider-key-MiniMax-China-\"],\n[id=\"provider-key-Alibaba-Cloud-DashScope-China-\"],\n[id=\"provider-key-Alibaba-Cloud-Token-Plan-\"],\n[id=\"provider-key-Alibaba-Cloud-Token-Plan-China-\"],\n[id=\"provider-key-Alibaba-Cloud-Coding-Plan-\"],\n[id=\"provider-key-Alibaba-Cloud-Coding-Plan-China-\"] {\n  display: none !important;\n}\n";
const accountTitles = new Set(['MiniMax', 'Qwen Code']);
const skillTitles = new Set(['page-agent', 'siyuan', 'yuanbao']);
const messengerTitles = new Set([
  'DingTalk', 'Feishu / Lark', 'WeCom (group bot)', 'WeCom (app)',
  'Weixin / WeChat (Personal)', 'QQ Bot', 'Yuanbao (元宝)'
]);
// Match only account-row title spans, never general page text or inputs.
const rowSelector = 'section.mb-5.grid.gap-2 > [data-slot="row-button"], section.mb-5.grid.gap-2 > div.group.grid';
const marker = 'data-hermes-provider-filter';

export default {
  id: 'provider-card-filter',
  name: 'Provider Card Filter',
  description: 'Hide selected Chinese-company provider, account, skill and messenger list entries. Credentials, installed components, model routing and the color palette are unchanged.',
  defaultEnabled: true,
  register(ctx) {
    const style = document.createElement('style');
    style.id = 'hermes-provider-card-filter';
    style.textContent = css + '\n[data-hermes-provider-filter="account"], [data-hermes-provider-filter="skill"], [data-hermes-provider-filter="messenger"] { display: none !important; }';
    document.head.appendChild(style);
    const marked = new Map();
    let lastCount = -1;
    const update = () => {
      const next = new Map();
      for (const row of document.querySelectorAll(rowSelector)) {
        const title = row.querySelector('[data-slot="row-button"] span.font-semibold, span.font-semibold');
        if (title && accountTitles.has(title.textContent.trim())) next.set(row, 'account');
      }
      // The tour ID stays language-independent, including the narrow tab layout.
      for (const tab of document.querySelectorAll('[data-tour="tab-skills"][data-active="true"]')) {
        const page = tab.closest('section');
        for (const row of page?.querySelectorAll('aside > div.overflow-y-auto > div.row-hover') ?? []) {
          const title = row.querySelector(':scope > [data-slot="row-button"] > span > span.block.truncate');
          if (title && skillTitles.has(title.textContent.trim())) next.set(row, 'skill');
        }
      }
      // PlatformRow has no platform-ID attribute. Hide the li, not its parents.
      for (const row of document.querySelectorAll('section aside > div.overflow-y-auto > ul.space-y-1 > li')) {
        const title = row.querySelector(':scope > button.row-hover > span.flex > span.truncate');
        if (title && messengerTitles.has(title.textContent.trim())) next.set(row, 'messenger');
      }
      for (const [row] of marked) {
        if (!next.has(row)) row.removeAttribute(marker);
      }
      for (const [row, kind] of next) {
        if (marked.get(row) !== kind) row.setAttribute(marker, kind);
      }
      marked.clear();
      for (const [row, kind] of next) marked.set(row, kind);
      if (next.size !== lastCount) {
        lastCount = next.size;
        window.hermesDesktop?.logLine?.('[provider-card-filter] rows-hidden=' + next.size);
      }
    };
    const observer = new MutationObserver(update);
    ctx.onDispose(() => {
      observer.disconnect();
      for (const [row] of marked) row.removeAttribute(marker);
      marked.clear();
      style.remove();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-active'] });
    update();
    window.hermesDesktop?.logLine?.('[provider-card-filter] enabled; accounts=' + accountTitles.size + '; skills=' + skillTitles.size + '; messengers=' + messengerTitles.size);
  }
};
