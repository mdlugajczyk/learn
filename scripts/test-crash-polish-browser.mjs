import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createDefaultProfile, makeCrashTask, createSeededRandom, createPlaygroundPlan } from '../public/numberblocks/game-model.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const origin = process.env.CRASH_TEST_ORIGIN || 'http://127.0.0.1:48889';
const output = '/private/tmp/crash-polish';
await mkdir(output, {recursive:true});
try {
  for (const scene of ['car', 'plane', 'runner', 'muted']) {
    const silent = scene === 'muted';
    const profile = createDefaultProfile({ settings: { reducedMotion: silent, effectsVolume: silent ? 0 : .55 } });
    const task = makeCrashTask(5, 3, { scene: silent ? 'car' : scene, random: createSeededRandom('polish') });
    profile.checkpoint = { phase: 'question', session: {
      id:'qa', seed:'qa', mode:'crash', tasks:[task], index:0, completed:0, built:[],
      playground:createPlaygroundPlan('qa',1), cosmetics:{}, startedAt:Date.now()
    }, taskState:{wrongSubmissions:0,firstAttemptCorrect:null,assistance:[],disabledAnswers:[],guided:false,modelAnswer:false,resolutionId:null} };
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.addInitScript(profile => {
      localStorage.setItem('tens-playground-v3',JSON.stringify(profile));
      localStorage.setItem('tens-playground-welcomed-v1','yes');
      window.__soundCount=0;
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function(...args) { window.__soundCount++; return original.apply(this,args); };
    }, profile);
    await page.goto(`${origin}/numberblocks/`);
    await page.locator('#resumeButton').click();
    if (!silent) {
      await page.locator('.crash-approaching').waitFor();
      await page.screenshot({path:`${output}/${scene}-approach.png`});
      await page.locator('.crash-contact').waitFor();
      await page.screenshot({path:`${output}/${scene}-impact.png`});
      const gap = await page.evaluate(() => {
        const vehicle=document.querySelector('.mystery-vehicle').getBoundingClientRect();
        const wall=document.querySelector('.crash-barrier').getBoundingClientRect();
        return wall.left-vehicle.right;
      });
      assert.ok(gap < 12, `${scene} must visibly touch the obstacle (gap ${gap})`);
    }
    await page.locator('.crash-settled').waitFor();
    assert.equal(await page.locator('.crash-stage .quantity-unit').count(), 5);
    const count=await page.evaluate(()=>window.__soundCount);
    assert.ok(silent ? count===0 : count>=10, `${scene}: sound count ${count}`);
    await page.locator('.answer-card[data-answer="5"]').click();
    await page.locator('.playground-update').waitFor();
    assert.deepEqual(errors, []);
    console.log(`${scene}: impact, sound, quantity and completion verified`);
    await context.close();
  }
} finally { await browser.close(); }
