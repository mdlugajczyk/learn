// PLAYWRIGHT_MODULE and CHROME_PATH may point to existing local installations.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const origin = process.env.CRASH_TEST_ORIGIN || 'http://127.0.0.1:48889';
const output = '/private/tmp/number-crash-checks';
await mkdir(output, { recursive: true });
const errors = [];
try {
  for (const viewport of [{width: 390, height: 844}, {width: 320, height: 568}, {width: 1133, height: 744}]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await page.goto(`${origin}/numberblocks/`);
    await page.locator('#firstPlayButton').click();
    await page.locator('#crashButton').click();
    const ready = () => page.waitForFunction(() => {
      const checkpoint = JSON.parse(localStorage.getItem('tens-playground-v3')).checkpoint;
      return checkpoint?.phase === 'question' && checkpoint.taskState.crashSeen;
    }, null, {timeout: 15000});
    await ready();
    const task = () => page.evaluate(() => { const c = JSON.parse(localStorage.getItem('tens-playground-v3')).checkpoint; return c.session.tasks[c.session.index]; });
    let current = await task();
    assert.equal(await page.locator('.crash-stage .quantity-unit').count(), current.sum);
    const cards = await page.locator('.answer-card').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}; }));
    console.log('Layout', viewport.width, await page.evaluate(() => ({ width:innerWidth, small:matchMedia('(max-width:374px)').matches, columns:getComputedStyle(document.querySelector('.answer-card')).gridTemplateColumns, panel:document.querySelector('.answer-panel').getBoundingClientRect().width, shell:document.querySelector('.task-shell').getBoundingClientRect().width })));
    for (const r of cards) { assert.ok(r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height, `card outside ${JSON.stringify(viewport)}: ${JSON.stringify(r)}`); }
    assert.ok(await page.locator('.task-action-row').evaluate(node => node.getBoundingClientRect().bottom <= innerHeight), 'Help controls must stay visible');
    await page.screenshot({path:`${output}/${viewport.width}-groups.png`});
    await page.locator('.crash-replay').click();
    await ready();
    assert.deepEqual(await task(), current);
    await page.locator(`.answer-card[data-answer="${current.sum}"]`).click();
    await page.locator('.playground-update').waitFor();
    console.log('Independent completion', viewport.width);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tens-playground-v3')).checkpoint.session.completed), 1);
    await page.locator('.next-button').click();
    await ready();
    current = await task();
    const wrong = current.options.find(value => value !== current.sum);
    await page.locator(`.answer-card[data-answer="${wrong}"]`).click();
    await page.locator('.help-button').click();
    await page.locator('#showHelpButton').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tens-playground-v3')).checkpoint?.taskState.guided);
    await page.locator(`.answer-card[data-answer="${current.sum}"]:enabled`).waitFor();
    await page.locator(`.answer-card[data-answer="${current.sum}"]`).click();
    console.log('Guided answer selected', viewport.width, await page.evaluate(() => JSON.parse(localStorage.getItem('tens-playground-v3')).checkpoint.phase));
    try { await page.locator('.playground-update').waitFor({timeout: 5000}); }
    catch (error) {
      console.log(await page.evaluate(() => ({ checkpoint: JSON.parse(localStorage.getItem('tens-playground-v3')).checkpoint, stage: document.querySelector('#taskStage').innerHTML, hidden:document.hidden, resume: document.querySelector('#resumeOverlay').hidden })));
      await page.screenshot({path:`${output}/failure.png`});
      throw error;
    }
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('tens-playground-v3')));
    assert.equal(profile.checkpoint.session.completed, 2);
    assert.ok(profile.checkpoint.taskState.assistance.includes('count'));
    await page.reload();
    await page.locator('#resumeButton').click();
    await page.locator('.playground-update').waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tens-playground-v3')).checkpoint.session.completed), 2);
    if (viewport.width === 390) {
      for (let slot = 2; slot < 6; slot += 1) {
        await page.locator('.next-button').click();
        if (slot === 2 || slot === 4) await page.locator('.cosmetic-choice').first().click();
        await ready();
        current = await task();
        assert.equal(await page.locator('.crash-group').count(), current.parts.length);
        assert.equal(await page.locator('.crash-stage .quantity-unit').count(), current.sum);
        await page.locator(`.answer-card[data-answer="${current.sum}"]`).click();
        await page.locator('.playground-update').waitFor();
      }
      await page.locator('.next-button').click();
      await page.locator('#finaleOverlay').waitFor();
      assert.equal(await page.locator('#finalePlayground button').count(), 6);
      await page.locator('#allDoneButton').click();
      await page.locator('#playgroundsButton').click();
      await page.locator('.saved-playground').first().click();
      await page.locator('#finaleOverlay').waitFor();
      assert.equal(await page.locator('#finalePlayground button').count(), 6);
    }
    if (viewport.width === 1133) {
      const tenProfile = await page.evaluate(async () => {
        const { makeCrashTask, createSeededRandom } = await import('/numberblocks/game-model.js');
        const profile = JSON.parse(localStorage.getItem('tens-playground-v3'));
        profile.settings.joinMax = 10;
        const checkpoint = profile.checkpoint;
        checkpoint.session.tasks[checkpoint.session.index] = makeCrashTask(10, 4, { introducedMax: 10, random: createSeededRandom('qa'), scene: 'plane', id: 'qa-ten' });
        checkpoint.phase = 'question';
        checkpoint.taskState = { wrongSubmissions: 0, firstAttemptCorrect: null, assistance: [], disabledAnswers: [], guided: false, modelAnswer: false, resolutionId: null };
        return profile;
      });
      // Install the fixture after the old page's visibility checkpoint has run.
      await page.addInitScript(profile => localStorage.setItem('tens-playground-v3', JSON.stringify(profile)), tenProfile);
      await page.reload();
      await page.locator('#resumeButton').click();
      await ready();
      assert.equal(await page.locator('.crash-group').count(), 4);
      assert.equal(await page.locator('.crash-stage .quantity-unit').count(), 10);
      await page.screenshot({path:`${output}/ten-four-groups.png`});
      await page.waitForFunction(() => document.querySelector('#offlineStatus').textContent.includes('Available offline'));
      await context.setOffline(true);
      await page.reload();
      await page.locator('#resumeButton').click();
      await ready();
      await page.locator('.answer-card[data-answer="10"]').click();
      await page.locator('.playground-update').waitFor();
      await context.setOffline(false);
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Mystery Crash browser checks passed at iPhone, small iPhone, and iPad landscape sizes.');
} finally { await browser.close(); }
