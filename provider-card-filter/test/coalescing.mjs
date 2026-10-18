import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const source = fs.readFileSync(new URL('../plugin.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<main><div id="chat">stream</div></main>');
  const result = await page.evaluate(async source => {
    const plugin = (await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))).default;
    // Keep real MutationObserver deliveries, but control when frames run.
    const frames = new Map();
    let nextFrame = 1;
    let queries = 0;
    let cancelled = 0;
    window.requestAnimationFrame = callback => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = id => {
      if (frames.delete(id)) cancelled++;
    };
    const originalQuery = document.querySelectorAll.bind(document);
    document.querySelectorAll = (...args) => {
      queries++;
      return originalQuery(...args);
    };
    const runFrame = () => {
      for (const [id, callback] of Array.from(frames)) {
        frames.delete(id);
        callback(performance.now());
      }
    };
    let dispose;
    plugin.register({ onDispose(callback) { dispose = callback; } });
    const initialQueries = queries;
    const stream = document.getElementById('chat').firstChild;
    // Yield after each mutation to produce separate observer deliveries.
    for (let i = 0; i < 20; i++) {
      stream.data = `stream ${i}`;
      await Promise.resolve();
    }
    const noScansBeforeFrame = queries === initialQueries;
    const oneQueuedFrame = frames.size === 1;
    runFrame();
    const oneScanForBurst = initialQueries > 0 && queries === initialQueries * 2 && frames.size === 0;
    stream.data = 'next frame';
    await Promise.resolve();
    const laterMutationQueuesFrame = frames.size === 1 && queries === initialQueries * 2;
    runFrame();
    const nextFrameScansAgain = queries === initialQueries * 3 && frames.size === 0;
    stream.data = 'pending disposal';
    await Promise.resolve();
    const queuedBeforeDispose = frames.size === 1;
    dispose();
    const pendingFrameCancelled = frames.size === 0 && cancelled === 1;
    const queriesAtDispose = queries;
    stream.data = 'after disposal';
    await Promise.resolve();
    runFrame();
    const observerStopped = frames.size === 0 && queries === queriesAtDispose;
    return { noScansBeforeFrame, oneQueuedFrame, oneScanForBurst, laterMutationQueuesFrame, nextFrameScansAgain, queuedBeforeDispose, pendingFrameCancelled, observerStopped };
  }, source);
  for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, name);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
