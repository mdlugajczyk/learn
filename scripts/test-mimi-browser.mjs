// Run against the production build with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const origin = process.env.MIMI_TEST_ORIGIN || 'http://127.0.0.1:4173';
const output = process.env.MIMI_TEST_OUTPUT || '/private/tmp/mimi-checks';
await mkdir(output, { recursive: true });
const failures = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(`${origin}/mimi/`);
  await page.waitForFunction(() => document.querySelector('#offlineStatus')?.textContent.includes('dostępna offline'));
  await page.screenshot({path:`${output}/iphone-home.png`});
  async function fit(label) {
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, next: document.querySelector('#next')?.getBoundingClientRect().bottom, height: innerHeight }));
    assert.equal(metrics.overflow, false, `${label}: horizontal overflow`);
    if (metrics.next > 0) assert.ok(metrics.next <= metrics.height, `${label}: next below viewport (${metrics.next}/${metrics.height})`);
  }
  await fit('iPhone home');
  await page.evaluate(async () => {
    const { Narrator } = await import('/mimi/audio.js');
    window.__spoken = [];
    window.__highlights = [];
    const play = Narrator.prototype.play;
    Narrator.prototype.play = function(id, options) {
      window.__spoken.push(id);
      window.__highlights.push({id, active: document.querySelector('.unit.active')?.dataset.unit ?? null});
      return play.call(this, id, options);
    };
    // Accelerate playback, retaining real MP3 media loading, playback and events.
    const playMedia = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(...args) { this.defaultPlaybackRate = 8; this.playbackRate = 8; return playMedia.apply(this, args); };
  });
  await page.locator('#start').click();
  let stepsChecked = 0;
  async function finishLesson(lesson) {
    await page.locator('.session').waitFor();
    let guard = 0;
    while (await page.locator('.session').count()) {
      if (++guard > 35) throw new Error('Session did not finish');
      const step = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mimi-reading-v1')).active; return s.steps[s.index]; });
      await fit(`${lesson}:${step.type}:${step.target || 'intro'}`);
      if (step.type === 'letter') await page.locator('#letter').click();
      if (step.type === 'word' || step.type === 'blend') {
        if (step.type === 'word' && ['MAMA', 'MIMI', 'TATA', 'LALA'].includes(step.target)) {
          assert.equal(await page.locator('.word-friend').count(), 1);
          assert.equal(await page.locator('.join-sign').textContent(), '–');
          await page.setViewportSize({width:375,height:667}); await fit(`small phone ${step.target}`);
          await page.setViewportSize({width:768,height:1024}); await fit(`iPad ${step.target}`);
          await page.setViewportSize({width:390,height:844});
          if (step.target === 'MAMA') await page.screenshot({path:`${output}/iphone-mama-syllables.png`});
        }
        await page.locator('#modelPlay').click();
      }
      if (step.type === 'read') {
        await page.waitForTimeout(550);
        const recent = await page.evaluate(() => window.__spoken.slice(-1)[0]);
        assert.equal(recent, 'read-tap', `Target leaked before answering ${step.target}: ${recent}`);
        if (step.target === 'MAMA' && lesson === 0) await page.screenshot({path:`${output}/iphone-reading.png`});
        if (step.parts && lesson === 4) await page.screenshot({path:`${output}/iphone-two-words.png`});
      }
      if (step.type === 'read' || step.type === 'contrast') await page.locator(`[data-answer="${step.target}"]`).click();
      await page.locator('#next').waitFor({state:'visible',timeout:20000});
      if (step.type === 'word' && ['MAMA', 'MIMI'].includes(step.target)) {
        const highlights = await page.evaluate(() => window.__highlights.slice(-3));
        assert.deepEqual(highlights, [
          {id: `word-${step.units[0].toLowerCase()}`, active: '0'},
          {id: `word-${step.units[1].toLowerCase()}`, active: '1'},
          {id: `word-${step.target.toLowerCase()}`, active: null}
        ]);
      }
      await fit(`${lesson}:${step.type}:next`);
      await page.locator('#next').click();
      stepsChecked++;
    }
    await page.locator('#finishHome').waitFor();
    await page.locator('#finishHome').click();
    console.log(`PASS: lesson ${lesson + 1}.`);
  }
  await finishLesson(0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mimi-reading-v1')).unlocked), 1);
  for (let lesson = 1; lesson < 6; lesson++) { await page.locator('#start').click(); await finishLesson(lesson); }
  console.log(`Completed ${stepsChecked} activities across all six lessons with real decoded audio.`);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mimi-reading-v1')).history.length), 6);
  await page.locator('#parent').click(); await page.locator('#parentCode').fill('RODZIC'); await page.locator('#parentGate button[type=submit]').click();
  await page.locator('#lessonSelect').selectOption('4'); await page.locator('#chooseLesson').click(); await page.locator('#start').click();
  await page.locator('.session').waitFor();
  await page.waitForTimeout(600);
  const target = await page.evaluate(() => { const s=JSON.parse(localStorage.getItem('mimi-reading-v1')).active; return s.steps[s.index].target; });
  await page.locator('[data-answer]').filter({ hasNot: page.locator('nonexistent') }).evaluateAll((buttons, correct) => buttons.find(button => button.dataset.answer !== correct).click(), target);
  await page.waitForFunction(() => !document.querySelector('.try-again'));
  assert.equal(await page.evaluate(() => { const s=JSON.parse(localStorage.getItem('mimi-reading-v1')).active; return s.states[s.index].mistakes; }), 1);
  await page.locator('#help').click();
  await page.locator('#help:not(:disabled)').waitFor();
  assert.equal(await page.evaluate(() => { const s=JSON.parse(localStorage.getItem('mimi-reading-v1')).active; return s.states[s.index].assisted; }), true);
  await page.locator(`[data-answer="${target}"]`).click(); await page.locator('#next').waitFor({state:'visible'});
  await page.locator('#home').click();
  await context.setOffline(true);
  const ranges = await page.evaluate(async () => {
    const result = [];
    for (const range of ['bytes=0-1', 'bytes=2-', 'bytes=-2', 'bytes=999999999-']) {
      const response = await fetch('./audio/word-ma.mp3', {headers:{Range:range}});
      result.push({status:response.status, size:(await response.arrayBuffer()).byteLength});
    }
    return result;
  });
  assert.equal(ranges[0].status, 206); assert.equal(ranges[0].size, 2);
  assert.equal(ranges[1].status, 206); assert.ok(ranges[1].size > 1000);
  assert.equal(ranges[2].status, 206); assert.equal(ranges[2].size, 2);
  assert.equal(ranges[3].status, 416);
  await page.reload(); await page.locator('#start').waitFor(); await page.locator('#start').click();
  await page.locator('#next').waitFor({state:'visible'}); await page.locator('#next').click();
  await page.waitForTimeout(600);
  await fit('offline reopen');
  assert.equal(await page.evaluate(() => navigator.onLine), false);
  await context.setOffline(false);
  await page.setViewportSize({width:768,height:1024});
  await page.screenshot({path:`${output}/ipad-mini-two-words.png`});
  await fit('iPad mini portrait');
  await page.setViewportSize({width:1024,height:768}); await fit('iPad mini landscape');
  await page.screenshot({path:`${output}/ipad-mini-landscape.png`});
  await page.setViewportSize({width:375,height:667}); await fit('iPhone SE');
  await page.screenshot({path:`${output}/iphone-se.png`});
  const brokenImages = await page.locator('img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).map(img => img.src));
  assert.deepEqual(brokenImages, []);
  assert.deepEqual(failures, []);
  console.log('PASS: independent reading, retry/help, first-try scoring, progress, offline reload, image loading, iPhone and iPad layouts.');
} finally { await browser.close(); }
