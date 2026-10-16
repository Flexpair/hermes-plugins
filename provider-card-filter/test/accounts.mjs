import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const pluginPath = new URL('../plugin.js', import.meta.url);
const source = fs.readFileSync(pluginPath, 'utf8');
const targets = ['MiniMax', 'Qwen Code'];
const controls = ['Nous Portal', 'ChatGPT or Codex Subscription', 'Anthropic Account', 'GitHub Copilot ACP', 'xAI Grok', 'OpenRouter', 'Fireworks AI'];
// HTML fixtures below contain only the fixed labels declared in this file.
// No app data, user input or credential values enter these test-only HTML sinks.
const row = (title, connected = false) => {
  const button = `<button data-slot="row-button"><div><span class="font-semibold">${title}</span><span>Connected</span></div><p>Account</p></button>`;
  return connected ? `<div class="group grid">${button}<button aria-label="Remove ${title}">Remove</button></div>` : button;
};
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<main id="app"><section class="mb-5 grid gap-2" id="accounts"><h2>Connect an account</h2>${controls.map(t => row(t)).join('')}</section><div id="chat"><span class="font-semibold">MiniMax</span>${row('Qwen Code')}</div><section class="mb-5 grid gap-2" id="unrelated"><p><span class="font-semibold">MiniMax</span></p></section><div id="provider-key-DeepSeek">DeepSeek</div></main>`);
  const result = await page.evaluate(async ({ source, targets, controls, disconnected, connected }) => {
    const plugin = (await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))).default;
    let dispose;
    plugin.register({ onDispose(fn) { dispose = fn; } });
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    const accounts = document.getElementById('accounts');
    const visible = element => element.checkVisibility();
    const titles = () => Array.from(accounts.children).filter(el => el.matches('[data-slot="row-button"], .group.grid'));
    accounts.insertAdjacentHTML('beforeend', disconnected);
    await tick();
    const disconnectedHidden = titles().filter(el => targets.includes(el.querySelector('span.font-semibold').textContent)).every(el => !visible(el));
    const controlsVisible = titles().filter(el => controls.includes(el.querySelector('span.font-semibold').textContent)).every(visible);
    accounts.innerHTML = '<h2>Connected accounts</h2>' + connected;
    await tick();
    const connectedHidden = targets.every(title => {
      const el = titles().find(el => el.querySelector('span.font-semibold').textContent === title);
      return el && !visible(el) && !el.querySelector('[aria-label^="Remove"]').checkVisibility();
    });
    const controlConnectedVisible = titles().find(el => el.querySelector('span.font-semibold').textContent === 'Nous Portal').checkVisibility();
    const first = titles()[0];
    first.querySelector('span.font-semibold').textContent = 'Anthropic Account';
    await tick();
    const changedTitleRestored = visible(first);
    const outsideUnaffected = visible(document.getElementById('chat')) && document.querySelector('#chat [data-slot="row-button"]').checkVisibility() && visible(document.getElementById('unrelated'));
    const keyHidden = !visible(document.getElementById('provider-key-DeepSeek'));
    const ancestorsVisible = visible(document.getElementById('app')) && visible(accounts);
    dispose();
    await tick();
    const allRestored = titles().every(visible) && visible(document.getElementById('provider-key-DeepSeek')) && document.querySelectorAll('[data-hermes-provider-filter]').length === 0;
    accounts.insertAdjacentHTML('beforeend', disconnected);
    await tick();
    const observerStopped = titles().every(visible);
    return { disconnectedHidden, controlsVisible, connectedHidden, controlConnectedVisible, changedTitleRestored, outsideUnaffected, keyHidden, ancestorsVisible, allRestored, observerStopped };
  }, { source, targets, controls, disconnected: targets.map(t => row(t)).join(''), connected: [...targets, 'Nous Portal'].map(t => row(t, true)).join('') });
  for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, name);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
