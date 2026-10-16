import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
const targets = ['page-agent', 'siyuan', 'yuanbao', 'baoyu-infographic'];
const controls = ['research', 'browser-use', 'siyuan-personal-notes', '中文学习'];
// Fixed, credential-free fixtures mirror CapRow and the Capabilities page tabs.
const row = (name, catalog = false) => `<div class="group/row row-hover flex w-full shrink-0 items-center rounded-md h-11"><button data-slot="row-button"><span class="min-w-0 flex-1"><span class="block truncate text-[0.78rem] font-normal">${name}</span><span>General skill; Qwen and DeepSeek are optional examples</span></span></button>${catalog ? '<span><button>Install</button></span>' : `<button role="switch" aria-checked="true" aria-label="${name}">Toggle</button>`}</div>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<style>:root { --accent: #c678dd; }</style><main id="app"><section id="capabilities"><div data-tour="page-tabs"><button data-tour="tab-skills" data-active="true">Skills</button><button data-tour="tab-toolsets" data-active="false">Toolsets</button></div><aside class="flex min-h-0 flex-col p-2"><div class="min-h-0 flex-1 overflow-y-auto" id="skills">${controls.map(n => row(n)).join('')}${targets.map(n => row(n)).join('')}<div>Official catalog</div>${targets.map(n => row(n, true)).join('')}</div></aside><div id="detail"><span class="block truncate">siyuan</span>${row('page-agent')}</div></section><section id="other"><aside class="flex min-h-0 flex-col p-2"><div class="overflow-y-auto">${row('yuanbao')}</div></aside></section><div id="chat">page-agent, SiYuan, Yuanbao</div></main>`);
  await page.evaluate(async source => {
    const plugin = (await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))).default;
    window.disposals = [];
    window.registerFilter = () => plugin.register({ onDispose(fn) { window.disposals.push(fn); } });
    window.registerFilter();
  }, source);
  const rows = page.locator('#skills > div.row-hover');
  assert.equal(await rows.count(), targets.length * 2 + controls.length);
  for (const title of targets) {
    const matches = rows.filter({ has: page.locator('span.block.truncate', { hasText: new RegExp(`^${title}$`) }) });
    assert.equal(await matches.count(), 2, `installed and catalog ${title}`);
    for (const entry of await matches.all()) assert.equal(await entry.isVisible(), true, `keep ${title} visible so its activation state and controls remain inspectable`);
  }
  for (const title of controls) assert.equal(await rows.filter({ has: page.locator('span.block.truncate', { hasText: title }) }).isVisible(), true, `preserve ${title}`);
  for (const id of ['app', 'capabilities', 'skills', 'detail', 'other', 'chat']) assert.equal(await page.locator(`#${id}`).isVisible(), true, `preserve ${id}`);
  assert.equal(await page.locator('#detail .row-hover').isVisible(), true, 'do not hide detail rows');
  assert.equal(await page.locator('#other .row-hover').isVisible(), true, 'do not hide unrelated lists');
  await page.locator('#skills').evaluate((node, html) => node.insertAdjacentHTML('beforeend', html), row('page-agent'));
  await page.locator('#skills > .row-hover').last().waitFor({ state: 'visible' });
  await page.locator('#skills > .row-hover').last().locator('span.block.truncate').evaluate(node => { node.firstChild.data = 'my-page-agent'; });
  await page.locator('#skills > .row-hover').last().waitFor({ state: 'visible' });
  await page.locator('[data-tour="tab-skills"]').evaluate(node => node.setAttribute('data-active', 'false'));
  await rows.nth(controls.length).waitFor({ state: 'visible' });
  await page.locator('[data-tour="tab-skills"]').evaluate(node => node.setAttribute('data-active', 'true'));
  await rows.nth(controls.length).waitFor({ state: 'visible' });
  await rows.nth(controls.length).evaluate(node => node.classList.remove('row-hover'));
  await rows.nth(controls.length - 1).waitFor({ state: 'visible' });
  assert.equal(await page.locator('#skills > div').nth(controls.length).isVisible(), true, 'class change restores the former target');
  await page.locator('#skills > div').nth(controls.length).evaluate(node => node.classList.add('row-hover'));
  await rows.nth(controls.length).waitFor({ state: 'visible' });
  await rows.nth(controls.length).evaluate(node => { const parent = node.parentNode; node.remove(); setTimeout(() => parent.appendChild(node), 0); });
  await rows.last().waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#c678dd', 'accent unchanged');
  await page.evaluate(() => window.disposals.pop()());
  for (const entry of await rows.all()) assert.equal(await entry.isVisible(), true, 'dispose restores skill rows');
  assert.equal(await page.locator('[data-hermes-provider-filter]').count(), 0, 'dispose removes markers');
  await page.locator('#skills').evaluate((node, html) => node.insertAdjacentHTML('beforeend', html), row('siyuan'));
  assert.equal(await rows.last().isVisible(), true, 'observer is stopped');
  await page.evaluate(() => window.registerFilter());
  await rows.last().waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-hermes-provider-filter="skill"]').count(), 0, 'skill rows are never presentation-filtered');
  await page.evaluate(() => window.disposals.pop()());
  console.log(JSON.stringify({ skillsRemainVisible: targets, installedAndCatalog: true, neutralSkills: controls, lateRows: true, titleChanges: true, tabScope: true, classChanges: true, reinsertion: true, accentUnchanged: true, disposalAndReregistration: true }));
} finally {
  await browser.close();
}
