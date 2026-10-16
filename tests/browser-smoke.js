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
    await page.waitForSelector('#molan-update-check', { timeout: 10000 });
    assert.equal(await page.locator('#molan-update-check').count(), 1,
      'A persistent global update-check action must be mounted for the workspace shell');

    assert.equal(await page.locator('[data-welcome-slide]').count(), 8, 'Welcome page should show eight introduction slides');
    assert.equal(await page.locator('[data-welcome-dot]').count(), 8, 'Every welcome slide should have a navigation dot');

    // Public download menu must work on touch-sized screens and remain keyboard accessible.
    const downloadTrigger = page.locator('#download-menu-trigger');
    const downloadPanel = page.locator('#download-menu-panel');
    assert.equal(await downloadPanel.isHidden(), true, 'Download menu starts closed');
    await downloadTrigger.click();
    await page.waitForFunction(() => {
      const trigger = document.querySelector('#download-menu-trigger');
      const panel = document.querySelector('#download-menu-panel');
      return trigger?.getAttribute('aria-expanded') === 'true' && panel && !panel.hidden;
    });
    assert.equal(await page.locator('#download-menu-panel a[href*="Molan-Business.apk"]').count(), 1,
      'Android download must be present in the menu');
    assert.equal(await page.locator('#download-menu-panel a[href*="Molan-Business-Setup.exe"]').count(), 1,
      'Windows download must be present in the menu');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const trigger = document.querySelector('#download-menu-trigger');
      const panel = document.querySelector('#download-menu-panel');
      return trigger?.getAttribute('aria-expanded') === 'false' && panel?.hidden;
    });
    await downloadTrigger.click();
    await page.locator('#welcome-copy, .welcome-copy, .welcome-nav').first().click({ position: { x: 5, y: 5 } });
    await page.waitForFunction(() => document.querySelector('#download-menu-panel')?.hidden,
      null, { timeout: 3000 }).catch(() => {});
    assert.equal(await downloadPanel.isHidden(), true, 'Clicking outside the download menu closes it');
    await page.waitForFunction(() => document.querySelector('[data-welcome-slide="0"]')?.classList.contains('active'));
    await page.locator('#welcome-next').click();
    await page.waitForFunction(() => document.querySelector('[data-welcome-slide="1"]')?.classList.contains('active'));
    await page.locator('#welcome-prev').click();
    await page.waitForFunction(() => document.querySelector('[data-welcome-slide="0"]')?.classList.contains('active'));
    await page.locator('[data-welcome-dot="7"]').click();
    await page.waitForFunction(() => document.querySelector('[data-welcome-slide="7"]')?.classList.contains('active'));
    await page.locator('[data-welcome-dot="0"]').click();
    await page.waitForFunction(() => document.querySelector('[data-welcome-slide="0"]')?.classList.contains('active'));
    const securityNote = page.locator('#welcome-security');
    const securityWasHidden = await securityNote.isHidden();
    await page.locator('#welcome-security-link').click();
    assert.equal(await securityNote.isHidden(), !securityWasHidden, 'Security explanation toggle should respond');
    await page.locator('#welcome-security-link').click();
    await page.locator('#welcome-learn-more').click();
    await page.waitForSelector('#learn-more-screen:not(.hidden)', { timeout: 10000 });
    assert.equal(await page.locator('[data-learn-slide]').count(), 8, 'Explainer should have eight full-page slides');
    assert.equal(await page.locator('[data-learn-dot]').count(), 8, 'Every explainer slide should have a navigation dot');
    await page.locator('[data-learn-next]').first().click();
    await page.waitForFunction(() => document.querySelector('[data-learn-slide="1"]')?.classList.contains('active'));
    await page.locator('[data-learn-dot="6"]').click();
    await page.waitForFunction(() => document.querySelector('[data-learn-slide="6"]')?.classList.contains('active'));
    assert.match(await page.locator('[data-learn-slide="6"]').innerText(), /Workshop Real Time/i);
    await page.locator('[data-learn-dot="7"]').click();
    await page.waitForFunction(() => document.querySelector('[data-learn-slide="7"]')?.classList.contains('active'));
    await page.locator('#learn-country').selectOption('UG');
    assert.match(await page.locator('#learn-pricing-result').innerText(), /Uganda/);
    const ugandaPricing = await page.locator('#learn-pricing-result').innerText();
    assert.match(ugandaPricing, /Gold is UGX 100,000 for 3 months/);
    assert.match(ugandaPricing, /Silver is UGX 70,000 for 2 months/);
    assert.match(ugandaPricing, /Premium is UGX 30,000 for 1 month/);
    await page.waitForFunction(() => {
      const grid = document.querySelector('#learn-plan-grid');
      return grid && grid.querySelectorAll('[data-learn-plan]').length >= 3 && grid.innerText.trim().length > 0;
    }, null, { timeout: 15000 });
    assert.match(await page.locator('#learn-plan-grid').innerText(), /Gold[\s\S]*3 months[\s\S]*Silver[\s\S]*2 months[\s\S]*Premium[\s\S]*1 month/i);
    assert.match(await page.locator('.learn-pricing-disclaimer').innerText(), /checkout.*not connected|not connected to live checkout/i);
    await page.locator('#learn-close').click();
    await page.waitForSelector('#welcome-screen:not(.hidden)', { timeout: 10000 });
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

    // Verify the separate private member portal renders cleanly on a phone-sized viewport.
    const portalPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    portalPage.on('pageerror', error => pageErrors.push('member portal: ' + error.message));
    const portalResponse = await portalPage.goto('https://zakpollyqueens.github.io/Molan-business-app-/member-portal.html?company=00000000-0000-0000-0000-000000000000&smoke=' + Date.now(), {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    assert(portalResponse && portalResponse.ok(), 'Member portal should return a successful HTTP response');
    await portalPage.waitForSelector('#login-form', { timeout: 10000 });
    assert.match(await portalPage.locator('h1').first().innerText(), /MOLAN.*MEMBER PORTAL/i);
    assert.equal(await portalPage.locator('#login-form input[name="pin"]').getAttribute('type'), 'password');
    const portalLayout = await portalPage.evaluate(() => ({
      radius: parseFloat(getComputedStyle(document.querySelector('.auth-card')).borderRadius),
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      stylesheetLoaded: [...document.styleSheets].some(sheet => (sheet.href || '').includes('member-portal.css'))
    }));
    assert(portalLayout.radius >= 18, 'Member portal should use the refined rounded card design');
    assert(portalLayout.width <= portalLayout.viewport + 1, 'Member portal should not overflow horizontally on mobile');
    assert(portalLayout.stylesheetLoaded, 'Member portal stylesheet should load');
    await portalPage.close();

    assert.equal(pageErrors.length, 0, 'Pages should not emit uncaught JavaScript errors: ' + pageErrors.join('; '));
    console.log('Browser smoke test passed: live response, eight-slide welcome, guided setup navigation, mobile layout, and auth-mode switching.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
