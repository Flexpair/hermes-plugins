import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
// Names captured from the core messaging catalog, not guessed from substrings.
const targets = ['DingTalk', 'Feishu / Lark', 'WeCom (group bot)', 'WeCom (app)', 'Weixin / WeChat (Personal)', 'QQ Bot', 'Yuanbao (元宝)'];
const controls = ['Telegram', 'Discord', 'Slack', 'Matrix', 'Signal', 'WhatsApp', 'LINE', 'Google Chat', 'Microsoft Teams', 'Custom DingTalk bridge'];
// Only fixed labels in this file enter the test HTML; no user data or credentials.
const row = title => `<li><button class="row-hover flex w-full items-center gap-2 rounded-md" type="button"><span aria-hidden="true" class="relative inline-grid size-6">X</span><span class="flex min-w-0 flex-1 items-center justify-between gap-2"><span class="truncate font-normal">${title}</span><span><span>Enabled</span></span></span></button></li>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<style>:root { --accent: #c678dd; }</style><main id="app"><section id="messaging"><aside class="flex min-h-0 flex-col p-2"><div class="min-h-0 flex-1 overflow-y-auto"><ul class="space-y-1" id="platforms">${targets.map(row).join('')}${controls.map(row).join('')}</ul></div></aside><div id="detail"><button class="row-hover"><span class="truncate">DingTalk</span></button></div></section><div id="chat"><ul>${row('DingTalk')}</ul></div><section id="plain-list"><aside><ul>${row('QQ Bot')}</ul></aside></section></main>`);
  await page.evaluate(async source => {
    const plugin = (await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))).default;
    window.disposals = [];
    window.registerFilter = () => plugin.register({ onDispose(fn) { window.disposals.push(fn); } });
    window.registerFilter();
  }, source);
  const rows = page.locator('#platforms > li');
  assert.equal(await rows.count(), targets.length + controls.length);
  for (const title of targets) {
    const entry = rows.filter({ has: page.locator('span.truncate', { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
    assert.equal(await entry.count(), 1, title);
    await entry.waitFor({ state: 'hidden' });
    assert.equal(await entry.locator('button').isVisible(), false, `hide entire ${title} row`);
  }
  for (const title of controls) assert.equal(await rows.filter({ has: page.locator('span.truncate', { hasText: title }) }).isVisible(), true, `preserve ${title}`);
  for (const id of ['app', 'messaging', 'platforms', 'detail', 'chat', 'plain-list']) assert.equal(await page.locator(`#${id}`).isVisible(), true, `preserve ${id}`);
  assert.equal(await page.locator('#chat li').isVisible(), true, 'do not filter chat');
  assert.equal(await page.locator('#plain-list li').isVisible(), true, 'do not filter unrelated lists');
  await page.locator('#platforms').evaluate((node, html) => node.insertAdjacentHTML('beforeend', html), row('WeCom (app)'));
  await rows.last().waitFor({ state: 'hidden' });
  await rows.last().locator('span.truncate').evaluate(node => { node.firstChild.data = 'My WeCom notes'; });
  await rows.last().waitFor({ state: 'visible' });
  await rows.first().locator('button').evaluate(node => node.classList.remove('row-hover'));
  await rows.first().waitFor({ state: 'visible' });
  await rows.first().locator('button').evaluate(node => node.classList.add('row-hover'));
  await rows.first().waitFor({ state: 'hidden' });
  await rows.first().evaluate(node => { const parent = node.parentNode; node.remove(); setTimeout(() => parent.appendChild(node), 0); });
  await rows.last().waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#c678dd', 'accent unchanged');
  await page.evaluate(() => window.disposals.pop()());
  for (const entry of await rows.all()) assert.equal(await entry.isVisible(), true, 'dispose restores messenger rows');
  assert.equal(await page.locator('[data-hermes-provider-filter]').count(), 0, 'dispose removes markers');
  await page.locator('#platforms').evaluate((node, html) => node.insertAdjacentHTML('beforeend', html), row('Yuanbao (元宝)'));
  assert.equal(await rows.last().isVisible(), true, 'observer is stopped');
  await page.evaluate(() => window.registerFilter());
  await rows.last().waitFor({ state: 'hidden' });
  await page.evaluate(() => window.disposals.pop()());
  console.log(JSON.stringify({ messengers: targets, controlsVisible: true, ancestorsVisible: true, lateRows: true, titleChanges: true, classChanges: true, reinsertion: true, accentUnchanged: true, disposalAndReregistration: true }));
} finally {
  await browser.close();
}
