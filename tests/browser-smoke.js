const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const response = await page.goto('https://zakpollyqueens.github.io/Molan-business-app-/?smoke=' + Date.now(), {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    assert(response && response.ok(), 'Published app should return a successful HTTP response');
    await page.waitForSelector('#welcome-screen:not(.hidden)', { timeout: 30000 });
    assert.equal(await page.locator('[data-welcome-slide]').count(), 8, 'Welcome page should show eight introduction slides');
    assert.equal(await page.locator('[data-welcome-dot]').count(), 8, 'Every welcome slide should have a navigation dot');
    await page.locator('#welcome-get-started').click();
    await page.waitForSelector('#guided-onboarding-screen:not(.hidden)', { timeout: 10000 });
    assert.equal(await page.locator('[data-guided-step]').count(), 6, 'Guided setup should have six steps');
    assert.equal(await page.locator('#guided-business-type').isVisible(), true);
    await page.locator('#guided-business-type').selectOption('School');
    await page.waitForFunction(() => document.querySelector('#guided-business-type')?.value === 'School');
    await page.locator('#guided-next').click();
    await page.waitForFunction(() => document.querySelector('[data-guided-step="1"]')?.classList.contains('active'), null, { timeout: 5000 }).catch(async () => {
      const status = await page.locator('#guided-status').innerText().catch(() => '(status unavailable)');
      throw new Error('Guided setup did not advance after selecting School. Status: ' + status);
    });
    assert.equal(await page.locator('#guided-progress-label').innerText(), 'STEP 2 OF 6',
      'Guided setup should advance to the owner account step');
    await page.locator('[data-guided-signin]').click();
    await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
    assert.equal(await page.locator('#setup-screen').evaluate(el => el.classList.contains('hidden')), true,
      'First-time visitors should not be asked to configure Supabase manually');
    assert.equal(await page.locator('#auth-title').innerText(), 'Welcome back');
    await page.locator('[data-auth-mode="signup"]').click();
    assert.equal(await page.locator('#auth-title').innerText(), 'Create your account');
    assert.equal(await page.locator('#display-name').isVisible(), true);
    assert.equal(await page.locator('#display-name').getAttribute('required'), '');
    await page.locator('[data-auth-mode="signin"]').click();
    assert.equal(await page.locator('#auth-title').innerText(), 'Welcome back');
    assert.equal(pageErrors.length, 0, 'Page should not emit uncaught JavaScript errors: ' + pageErrors.join('; '));
    console.log('Browser smoke test passed: live response, eight-slide welcome, guided setup navigation, mobile layout, and auth-mode switching.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
