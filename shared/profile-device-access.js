(() => {
  'use strict';
  // Always repair the profile hamburger first; a pre-existing dialog must not
  // prevent the access menu item from being restored after navigation rebuilds.
  const isInstalledApp = () => !!window.MolanBusinessNative ||
    !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
    /Electron/i.test(navigator.userAgent || '');
  if (isInstalledApp()) document.documentElement.classList.add('molan-native-app');
  const getMenu = () => document.querySelector('[data-profile-menu]');
  const getNav = () => getMenu()?.querySelector('nav');
  const createAccessLink = () => {
    const item = document.createElement('a');
    item.href = '#give-device-access';
    item.dataset.giveDeviceAccess = '';
    const icon = document.createElement('span');
    icon.textContent = '🔐';
    const label = document.createElement('strong');
    label.textContent = isInstalledApp() ? 'Close Access on This App' : 'Give Access to Mobile & PC App';
    item.append(icon, label);
    return item;
  };
  const ensureAccessMenuItem = () => {
    const currentNav = getNav();
    if (!currentNav) return;
    const existing = currentNav.querySelectorAll('[data-give-device-access]');
    if (existing.length > 1) existing.forEach((item, index) => { if (index > 0) item.remove(); });
    const accessItem = currentNav.querySelector('[data-give-device-access]') || createAccessLink();
    const label = accessItem.querySelector('strong');
    if (label) label.textContent = isInstalledApp() ? 'Close Access on This App' : 'Give Access to Mobile & PC App';
    accessItem.setAttribute('aria-label', isInstalledApp() ? 'Close access on this app' : 'Give access to the Molan Business app');
    // Keep the action after the final business-profile feature in the hamburger.
    if (currentNav.lastElementChild !== accessItem) currentNav.append(accessItem);
  };
  // Do not exit when a profile menu is rendered late. Observe the document so
  // delayed menus and profile.json navigation rebuilds are repaired as well.
  ensureAccessMenuItem();

  const style = document.createElement('style');
  style.dataset.deviceAccessStyles = '';
  style.textContent = `
    @keyframes giveAccessPulse{0%,100%{box-shadow:0 0 0 0 #08a5d544,0 5px 16px #0787bf12;transform:translateY(0)}50%{box-shadow:0 0 0 5px #08a5d51c,0 8px 22px #0787bf28;transform:translateY(-1px)}}
    @keyframes giveAccessShimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    .profile-menu nav a[data-give-device-access]{position:relative;isolation:isolate;overflow:hidden;border:1px solid #70d1ef;background:linear-gradient(110deg,#e9faff,#fff,#e4f7ff,#fff);background-size:200% 100%;font-weight:800;animation:giveAccessPulse 2.2s ease-in-out infinite,giveAccessShimmer 5s linear infinite;transition:transform .2s ease,border-color .2s ease}
    .profile-menu nav a[data-give-device-access]::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 20%,#fff9 48%,transparent 72%);transform:translateX(-120%);animation:giveAccessSweep 3.6s ease-in-out infinite}
    @keyframes giveAccessSweep{0%,45%{transform:translateX(-120%)}75%,100%{transform:translateX(120%)}}
    .profile-menu nav a[data-give-device-access] span{display:grid;place-items:center;min-width:30px;height:30px;border-radius:9px;background:#d7f5ff;box-shadow:inset 0 0 0 1px #a5e8fa;animation:giveAccessIconGlow 2.2s ease-in-out infinite}
    @keyframes giveAccessIconGlow{0%,100%{transform:scale(1);filter:drop-shadow(0 0 0 #08a5d500)}50%{transform:scale(1.09);filter:drop-shadow(0 0 5px #08a5d588)}}
    .profile-menu nav a[data-give-device-access] strong{font-size:13px;position:relative;z-index:1}
    .profile-menu nav a[data-give-device-access]:hover,.profile-menu nav a[data-give-device-access]:focus-visible{transform:translateY(-2px);border-color:#0787bf;outline:2px solid #0787bf55;outline-offset:2px}
    @media(prefers-reduced-motion:reduce){.profile-menu nav a[data-give-device-access],.profile-menu nav a[data-give-device-access]::after,.profile-menu nav a[data-give-device-access] span{animation:none!important;transition:none!important}}
    .device-access-dialog{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:#07152bd9}
    .device-access-dialog[hidden]{display:none}
    .device-access-card{width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;color:#10213e;border:1px solid #dce5f1;border-radius:22px;padding:22px;box-shadow:0 24px 80px #07152b55;font:15px/1.5 system-ui}
    .device-access-card h2{margin:8px 0;font-size:clamp(22px,5vw,28px)}
    .device-access-card p{color:#5c6e85;line-height:1.6}
    .device-access-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}
    .device-access-option{padding:14px;border:1px solid #d7e2ef;border-radius:14px;background:#f6faff;color:#10213e;text-align:left;cursor:pointer;font:inherit}
    .device-access-option[aria-pressed=true]{border-color:#0787bf;background:#e7f7ff;box-shadow:0 0 0 2px #0787bf22}
    .device-access-option strong,.device-access-option small{display:block}
    .device-access-option small{margin-top:5px;color:#65758b}
    .device-access-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
    .device-access-actions button{border:1px solid #cbd8e8;border-radius:12px;padding:12px 15px;background:#0787bf;color:#fff;font:700 14px system-ui;cursor:pointer}
    .device-access-actions button.secondary{background:#fff;color:#10213e}
    .device-access-note{padding:12px;border-radius:12px;background:#fff7e8;border:1px solid #f2d7a4;color:#754c08;font-size:13px;line-height:1.55}
    @media(max-width:440px){.device-access-options{grid-template-columns:1fr}.device-access-card{padding:17px}}

    html.molan-native-app .profile-menu nav a[data-give-device-access]{background:linear-gradient(110deg,#fff3e6,#fff,#fff0e3)!important;border-color:#f1b47a!important;animation:none!important}
    html.molan-native-app .profile-menu nav a[data-give-device-access] span{background:#fff0dc!important;box-shadow:inset 0 0 0 1px #f1c89d!important}
    .device-access-error{padding:10px 12px;border-radius:10px;background:#fff0f0;border:1px solid #efb1b1;color:#8b2222!important;font-size:13px}
    .device-access-actions [data-device-access-download]{align-self:center;color:#087eaf;font-size:13px;font-weight:700;text-decoration:none}
    .device-access-actions [data-device-access-download]:hover{text-decoration:underline}
  `;
  document.head.append(style);

  const dialog = document.createElement('div');
  dialog.className = 'device-access-dialog';
  dialog.dataset.profileDeviceAccessDialog = '';
  dialog.setAttribute('data-profile-device-access-dialog', '');
  dialog.hidden = true;
  dialog.innerHTML = `
    <section class="device-access-card" role="dialog" aria-modal="true" aria-labelledby="device-access-title">
      <div style="font-size:11px;font-weight:850;letter-spacing:.14em;color:#0787bf">MOLAN BUSINESS · SECURE DEVICE ACCESS</div>
      <h2 id="device-access-title">Give access to your mobile or PC app</h2>
      <p>Authorize your own signed-in account to open in the installed Molan Business app. You must approve this request explicitly.</p>
      <div class="device-access-options">
        <button type="button" class="device-access-option" data-access-target="mobile" aria-pressed="true"><strong>📱 Mobile app</strong><small>Android</small></button>
        <button type="button" class="device-access-option" data-access-target="pc" aria-pressed="false"><strong>💻 PC app</strong><small>Windows or desktop</small></button>
      </div>
      <div class="device-access-note">A one-time approval code expires after 2 minutes and can be used only once. Never share your sign-in details.</div>
      <p data-device-access-account role="status">Checking your signed-in account…</p>
      <p data-device-access-status role="status">Selected: Android / mobile app</p>
      <p data-device-access-error class="device-access-error" role="alert" hidden></p>
      <div class="device-access-actions">
        <button type="button" data-device-access-confirm disabled>Checking account…</button>
        <a data-device-access-download href="https://github.com/zakpollyqueens/Molan-business-app-/releases/latest" target="_blank" rel="noopener">Don't have the app? Download it</a>
        <button type="button" class="secondary" data-device-access-close>Cancel</button>
      </div>
    </section>`;
  document.body.append(dialog);

  // Profile navigation can be rebuilt asynchronously from profile.json. Re-apply
  // the browser Give Access / native Close Access action after every menu rebuild.
  const observer = new MutationObserver(() => ensureAccessMenuItem());
  let observerStarted = false;
  const observeWhenReady = () => {
    ensureAccessMenuItem();
    if (document.body && !observerStarted) {
      observer.observe(document.body, { childList: true, subtree: true });
      observerStarted = true;
    }
  };
  observeWhenReady();
  if (!observerStarted) document.addEventListener('DOMContentLoaded', observeWhenReady, { once: true });

  let target = 'mobile';
  let authClientPromise = null;
  const accountLabel = dialog.querySelector('[data-device-access-account]');
  const errorBox = dialog.querySelector('[data-device-access-error]');
  const confirmButton = dialog.querySelector('[data-device-access-confirm]');
  const status = dialog.querySelector('[data-device-access-status]');
  const closeButton = dialog.querySelector('[data-device-access-close]');
  const closeDialog = () => { dialog.hidden = true; document.querySelector('[data-give-device-access]')?.focus(); };
  const showError = message => { errorBox.textContent = message; errorBox.hidden = false; };
  const loadSupabase = async () => {
    if (window.supabase?.createClient) return window.supabase;
    if (!window.__molanSupabaseLibraryPromise) {
      window.__molanSupabaseLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('The secure sign-in library did not load.'));
        script.onerror = () => reject(new Error('Could not load the secure sign-in library. Check your connection and try again.'));
        document.head.appendChild(script);
      });
    }
    return window.__molanSupabaseLibraryPromise;
  };
  const getAuthClient = async () => {
    if (!authClientPromise) authClientPromise = (async () => {
      const library = await loadSupabase();
      let config = null;
      try { config = JSON.parse(localStorage.getItem('molan_supabase_config_v1') || 'null'); } catch {}
      const url = config?.url || 'https://rcubnewrfieqhwcnvrzs.supabase.co';
      const key = config?.key || 'sb_publishable_0T7DCcWPMHr5sRGMUcc8sQ_8jnobyYQ';
      return library.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    })();
    return authClientPromise;
  };
  const closeInstalledAccess = async item => {
    const label = item.querySelector('strong');
    const original = 'Close Access on This App';
    if (label) label.textContent = 'Closing access…';
    item.setAttribute('aria-busy', 'true');
    try {
      try { window.MolanBusinessNative?.closeAppAccess?.(); } catch (_) {}
      const client = await getAuthClient();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      try { localStorage.removeItem('molan_business_app_access_active'); } catch {}
      if (label) label.textContent = 'Access Closed';
      item.setAttribute('aria-label', 'App access closed on this device');
      window.setTimeout(() => {
        if (label) label.textContent = original;
        item.removeAttribute('aria-busy');
      }, 2400);
      window.alert('Access to Molan Business has been closed on this device. Sign in again to reconnect.');
    } catch (error) {
      if (label) label.textContent = original;
      item.removeAttribute('aria-busy');
      window.alert(error?.message || 'Access could not be closed. Please try again.');
    }
  };
  document.addEventListener('click', async event => {
    const accessLink = event.target.closest('[data-give-device-access]');
    if (!accessLink) return;
    event.preventDefault();
    if (isInstalledApp()) {
      await closeInstalledAccess(accessLink);
      return;
    }
    dialog.hidden = false;
    errorBox.hidden = true;
    accountLabel.textContent = 'Checking your signed-in Molan Business account…';
    confirmButton.disabled = true;
    confirmButton.textContent = 'Checking account…';
    confirmButton._molanSession = null;
    try {
      const client = await getAuthClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session?.user) throw new Error('Sign in to Molan Business in this browser first, then try again.');
      accountLabel.textContent = 'Signed in as ' + (data.session.user.email || 'your Molan Business account');
      confirmButton.disabled = false;
      confirmButton.textContent = 'Authorize & open Molan Business';
      confirmButton._molanSession = data.session;
    } catch (error) {
      accountLabel.textContent = 'No active account detected.';
      showError(error?.message || 'Sign in to Molan Business in this browser first.');
      confirmButton.disabled = true;
      confirmButton.textContent = 'Sign in required';
    }
  });
  dialog.querySelectorAll('[data-access-target]').forEach(button => button.addEventListener('click', () => {
    target = button.dataset.accessTarget;
    dialog.querySelectorAll('[data-access-target]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    status.textContent = 'Selected: ' + (target === 'mobile' ? 'Android / mobile app' : 'Windows / PC app');
  }));
  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.hidden) closeDialog(); });
  confirmButton.addEventListener('click', async () => {
    errorBox.hidden = true;
    const currentSession = confirmButton._molanSession;
    if (!currentSession?.access_token) {
      showError('Sign in to Molan Business in this browser first, then try again.');
      return;
    }
    const profileSlug = String(document.body.dataset.profile || '').trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileSlug)) {
      showError('This business profile could not be verified. Refresh the page and try again.');
      return;
    }
    confirmButton.disabled = true;
    confirmButton.textContent = 'Authorizing this device…';
    try {
      const config = JSON.parse(localStorage.getItem('molan_supabase_config_v1') || 'null');
      const supabaseUrl = (config?.url || 'https://rcubnewrfieqhwcnvrzs.supabase.co').replace(/\/$/, '');
      const supabaseKey = config?.key || 'sb_publishable_0T7DCcWPMHr5sRGMUcc8sQ_8jnobyYQ';
      const response = await fetch(supabaseUrl + '/functions/v1/business-app-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': 'Bearer ' + currentSession.access_token },
        body: JSON.stringify({ action: 'create', profileSlug, targetDevice: target })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.appUrl) throw new Error(payload.error || 'Could not authorize the app. Please try again.');
      try { sessionStorage.setItem('molan_business_pending_profile_access_v1', JSON.stringify({ profileSlug, targetDevice: target, requestedAt: Date.now() })); } catch {}
      window.location.href = payload.appUrl;
      confirmButton.textContent = 'Opening Molan Business…';
      window.setTimeout(() => {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Authorize & open Molan Business';
        showError('If the app did not open, install the Molan Business app first. This approval expires after 2 minutes; you can authorize again.');
      }, 1500);
    } catch (error) {
      showError(error?.message || 'Authorization failed. Please try again.');
      confirmButton.disabled = false;
      confirmButton.textContent = 'Authorize & open Molan Business';
    }
  });
  // Direct workspace entry should open the same secure prompt as a profile-menu click.
  if (new URLSearchParams(window.location.search).get('open-device-access') === '1') {
    window.setTimeout(() => document.querySelector('[data-give-device-access]')?.click(), 0);
  }
})();
