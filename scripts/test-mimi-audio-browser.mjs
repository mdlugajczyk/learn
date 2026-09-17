// Audio failure recovery in the real UI; no platform audio mute is simulated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const origin = process.env.MIMI_TEST_ORIGIN || 'http://127.0.0.1:4173';
try {
  for (const mode of ['blocked', 'stalled']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${origin}/mimi/`);
    await page.waitForFunction(() => document.querySelector('#offlineStatus')?.textContent.includes('dostępna offline'));
    await page.evaluate(mode => {
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() {
        HTMLMediaElement.prototype.play = original;
        return mode === 'blocked' ? Promise.reject(new DOMException('Tap required', 'NotAllowedError')) : new Promise(() => {});
      };
    }, mode);
    await page.locator('#start').click();
    await page.locator('#recover').waitFor({ timeout: 12000 });
    assert.equal(await page.locator('#letter').textContent(), 'A');
    await page.locator('#recover').click();
    await page.locator('#letter').click();
    await page.locator('#next').waitFor({ state: 'visible' });
    await page.locator('#next').click();
    assert.equal(await page.locator('#letter').textContent(), 'M');
    assert.equal(await page.locator('dialog').count(), 0);
    await page.locator('#letter').click();
    // Navigating away cancels an in-flight narration without a delayed error.
    await page.locator('#home').click();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('dialog').count(), 0);
    await page.locator('#start').click();
    await page.locator('#letter').click();
    await page.locator('#next').waitFor({ state: 'visible' });
    console.log(`PASS: ${mode} playback recovers and lesson remains interactive.`);
    await page.close();
  }
} finally { await browser.close(); }
