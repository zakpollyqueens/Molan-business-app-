(() => {
  'use strict';
  if (document.querySelector('[data-profile-device-access-dialog]')) return;
  const getMenu = () => document.querySelector('[data-profile-menu]');
  const getNav = () => getMenu()?.querySelector('nav');
  const createAccessLink = () => {
    const item = document.createElement('a');
    item.href = '#give-device-access';
    item.dataset.giveDeviceAccess = '';
    const icon = document.createElement('span');
    icon.textContent = '🔐';
    const label = document.createElement('strong');
    label.textContent = 'Give Access to Mobile & PC App';
    item.append(icon, label);
    return item;
  };
  const ensureAccessMenuItem = () => {
    const currentNav = getNav();
    if (!currentNav) return;
    const existing = currentNav.querySelectorAll('[data-give-device-access]');
    if (existing.length > 1) existing.forEach((item, index) => { if (index > 0) item.remove(); });
    if (!currentNav.querySelector('[data-give-device-access]')) currentNav.append(createAccessLink());
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
  `;
  document.head.append(style);

  const dialog = document.createElement('div');
  dialog.className = 'device-access-dialog';
  dialog.dataset.profileDeviceAccessDialog = '';
  dialog.hidden = true;
  dialog.innerHTML = `
    <section class="device-access-card" role="dialog" aria-modal="true" aria-labelledby="device-access-title">
      <div style="font-size:11px;font-weight:850;letter-spacing:.14em;color:#0787bf">MOLAN BUSINESS · DEVICE ACCESS</div>
      <h2 id="device-access-title">Give access to your mobile or PC app</h2>
      <p>Choose the device you want to connect to this business profile. Use your own Molan Business account and never share your password or verification codes.</p>
      <div class="device-access-options">
        <button type="button" class="device-access-option" data-access-target="mobile" aria-pressed="true"><strong>📱 Mobile app</strong><small>Android or iPhone</small></button>
        <button type="button" class="device-access-option" data-access-target="pc" aria-pressed="false"><strong>💻 PC app</strong><small>Windows or desktop</small></button>
      </div>
      <div class="device-access-note">Selecting a device here does not grant access by itself. The target device must sign in and be authorized through the account/workspace access flow.</div>
      <p data-device-access-status role="status">Selected: Mobile app</p>
      <div class="device-access-actions">
        <button type="button" data-device-access-continue>Continue to Molan Business</button>
        <button type="button" class="secondary" data-device-access-close>Cancel</button>
      </div>
    </section>`;
  document.body.append(dialog);

  let target = 'mobile';
  const status = dialog.querySelector('[data-device-access-status]');
  const closeButton = dialog.querySelector('[data-device-access-close]');
  const close = () => { dialog.hidden = true; document.querySelector('[data-give-device-access]')?.focus(); };
  document.addEventListener('click', event => {
    const accessLink = event.target.closest('[data-give-device-access]');
    if (!accessLink) return;
    event.preventDefault();
    dialog.hidden = false;
    dialog.querySelector('[data-access-target="mobile"]').focus();
  });
  // Keep the action present even when profile navigation is replaced after
  // profile.json loads or the hamburger is inserted after this script executes.
  const observer = new MutationObserver(() => ensureAccessMenuItem());
  const observeWhenReady = () => {
    ensureAccessMenuItem();
    if (document.body && !observerStarted) {
      observer.observe(document.body, { childList: true, subtree: true });
      observerStarted = true;
    }
  };
  let observerStarted = false;
  observeWhenReady();
  if (!observerStarted) {
    document.addEventListener('DOMContentLoaded', observeWhenReady, { once: true });
  }
  dialog.querySelectorAll('[data-access-target]').forEach(button => button.addEventListener('click', () => {
    target = button.dataset.accessTarget;
    dialog.querySelectorAll('[data-access-target]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    status.textContent = 'Selected: ' + (target === 'mobile' ? 'Mobile app' : 'PC app');
  }));
  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.hidden) close(); });

  dialog.querySelector('[data-device-access-continue]').addEventListener('click', () => {
    const profile = document.body.dataset.profile || '';
    const currentMenu = getMenu();
    const profileName = currentMenu?.querySelector('.profile-menu-head strong')?.textContent || document.title;
    try {
      sessionStorage.setItem('molan_device_access_request_v1', JSON.stringify({
        profile, profileName, target, requestedAt: Date.now()
      }));
    } catch {}
    const appLink = getMenu()?.querySelector('.profile-menu-app');
    if (!appLink?.href) {
      status.textContent = 'Open Molan Business and sign in to continue. No device access has been granted yet.';
      return;
    }
    const destination = new URL(appLink.href, location.href);
    destination.searchParams.set('deviceAccess', '1');
    destination.searchParams.set('deviceType', target);
    destination.searchParams.set('profile', profile);
    location.href = destination.href;
  });
})();