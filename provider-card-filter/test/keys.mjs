import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
const targets = JSON.parse(fs.readFileSync(new URL('./targets.json', import.meta.url), 'utf8'));
for (const target of targets) {
  assert.equal(target.elementId, `provider-key-${target.label.replace(/\W+/g, '-')}`);
}
const controls = ['Anthropic', 'OpenRouter', 'Google AI Studio', 'OpenAI API', 'NovitaAI', 'NVIDIA NIM'];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<main id="app"><section id="settings"><div id="cards"></div></section></main>');
  const result = await page.evaluate(async ({ source, targets, controls }) => {
    document.documentElement.style.setProperty('--accent', '#00ffff');
    const plugin = (await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))).default;
    let dispose;
    plugin.register({ onDispose(fn) { dispose = fn; } });
    const parent = document.getElementById('cards');
    for (const label of [...targets.map(t => t.label), ...controls]) {
      const card = document.createElement('div');
      card.id = `provider-key-${label.replace(/\W+/g, '-')}`;
      card.textContent = label;
      const input = document.createElement('input');
      input.type = 'password';
      card.appendChild(input);
      parent.appendChild(card);
    }
    const visibility = id => document.getElementById(id).checkVisibility();
    const hidden = targets.filter(t => !visibility(t.elementId)).map(t => t.provider);
    const shown = controls.filter(label => visibility(`provider-key-${label.replace(/\W+/g, '-')}`));
    const rootVisible = visibility('app') && visibility('settings');
    const accentUnchanged = document.documentElement.style.getPropertyValue('--accent') === '#00ffff';
    dispose();
    const restored = targets.every(t => visibility(t.elementId));
    plugin.register({ onDispose(fn) { dispose = fn; } });
    const styleCount = document.querySelectorAll('#hermes-provider-card-filter').length;
    dispose();
    return { hidden, shown, rootVisible, accentUnchanged, restored, styleCount };
  }, { source, targets, controls });
  assert.equal(result.hidden.length, targets.length);
  assert.equal(result.shown.length, controls.length);
  assert.equal(result.rootVisible, true);
  assert.equal(result.accentUnchanged, true);
  assert.equal(result.restored, true);
  assert.equal(result.styleCount, 1);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
