const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    const response = await page.goto('https://zakpollyqueens.github.io/Molan-business-app-/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    assert(response && response.ok(), 'Published app should return a successful HTTP response');
    await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 30000 });
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
    console.log('Browser smoke test passed: live response, automatic connection screen, mobile layout, and auth-mode switching.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
