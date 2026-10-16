/* Cross-platform Molan Business update checker.
   Web/PWA users refresh the live site. Installed Android/desktop apps are directed to
   the matching published installer; the OS still asks the user to approve installation. */
(() => {
  const RELEASE_API = 'https://api.github.com/repos/zakpollyqueens/Molan-business-app-/releases/latest';
  const RELEASE_PAGE = 'https://github.com/zakpollyqueens/Molan-business-app-/releases/latest';
  let latest = null;
  let busy = false;
  let timer = null;

  const isNative = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  const isElectron = () => /Electron/i.test(navigator.userAgent || '');
  const normalize = value => String(value || '').trim().replace(/^v/i, '');
  const currentVersion = () => normalize(window.MOLAN_APP_VERSION || document.documentElement.dataset.appVersion || '');

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 4200);
  }

  function banner() {
    let el = document.getElementById('molan-update-banner');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'molan-update-banner';
    el.className = 'molan-update-banner';
    el.setAttribute('role', 'status');
    el.hidden = true;
    el.innerHTML = '<div class="molan-update-copy"><strong id="molan-update-heading">Update available</strong><p id="molan-update-message">A new Molan Business release is ready.</p></div><button class="button primary small" id="molan-apply-update" type="button">Update now ↻</button>';
    document.querySelector('#app')?.prepend(el);
    el.querySelector('#molan-apply-update').addEventListener('click', applyUpdate);
    return el;
  }

  function setCheckButton(label, hasUpdate = false) {
    const button = document.getElementById('molan-update-check');
    if (!button) return;
    button.textContent = label;
    button.classList.toggle('has-update', hasUpdate);
  }

  function mount() {
    const actions = document.querySelector('.top-actions');
    if (!actions || document.getElementById('molan-update-check')) return;
    const button = document.createElement('button');
    button.id = 'molan-update-check';
    button.type = 'button';
    button.className = 'button secondary small molan-update-check';
    button.textContent = 'Check for updates ↻';
    button.setAttribute('aria-label', 'Check Molan Business for application updates');
    button.title = 'Check for updates or download the latest app installer';
    button.addEventListener('click', () => check(true));
    actions.insertBefore(button, actions.firstChild);
  }

  async function fetchLatest() {
    const response = await fetch(RELEASE_API + '?check=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Accept': 'application/vnd.github+json', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Could not reach the latest release service.');
    const release = await response.json();
    const tag = normalize(release.tag_name);
    if (!tag) throw new Error('The latest release has no version tag.');
    return { version: tag, release };
  }

  function assetForPlatform(release) {
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const android = isNative() && /android/i.test(window.Capacitor?.getPlatform?.() || navigator.userAgent);
    const platform = android ? 'android' : /Android/i.test(navigator.userAgent) ? 'android'
      : /Win/i.test(navigator.platform) || isElectron() && /win/i.test(navigator.userAgent) ? 'windows'
      : /Mac/i.test(navigator.platform) ? 'macos'
      : /Linux/i.test(navigator.platform) ? 'linux' : 'web';
    const patterns = {
      android: /^Molan-Business\.apk$/i,
      windows: /^Molan-Business-Setup\.exe$/i,
      macos: /\.dmg$/i,
      linux: /\.AppImage$/i
    };
    const asset = assets.find(item => patterns[platform]?.test(item.name));
    return { platform, url: asset?.browser_download_url || release.html_url || RELEASE_PAGE, assetName: asset?.name || '' };
  }

  async function applyUpdate() {
    if (!latest) return;
    if (latest.native) {
      const message = latest.platform === 'android'
        ? 'The Android update will download. Open the downloaded APK and approve installation when Android asks.'
        : 'The desktop installer will download. Close Molan Business and run the installer to finish updating.';
      notify(message);
      const opened = window.open(latest.url, '_blank', 'noopener,noreferrer');
      if (!opened && !isElectron()) {
        window.location.assign(latest.url);
      }
      return;
    }
    const button = document.getElementById('molan-apply-update');
    if (button) { button.disabled = true; button.textContent = 'Refreshing…'; }
    const url = new URL(window.location.href);
    url.searchParams.set('molan_release', latest.version);
    url.searchParams.set('refresh', String(Date.now()));
    window.location.replace(url.toString());
  }

  async function check(manual = false) {
    if (busy) return;
    busy = true;
    const button = document.getElementById('molan-update-check');
    if (button) { button.disabled = true; button.textContent = 'Checking updates…'; }
    try {
      const native = isNative() || isElectron();
      let latestVersion, release = null;
      if (native) {
        const result = await fetchLatest();
        latestVersion = result.version;
        release = result.release;
      } else {
        const manifestUrl = new URL('version.json', window.location.href);
        manifestUrl.searchParams.set('check', String(Date.now()));
        const response = await fetch(manifestUrl.toString(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (!response.ok) throw new Error('The update manifest is unavailable.');
        const manifest = await response.json();
        latestVersion = normalize(manifest.version || manifest.currentVersion);
        if (!latestVersion) throw new Error('The update manifest has no version.');
      }

      const current = currentVersion();
      const available = !!current && latestVersion !== current;
      if (available) {
        const destination = native ? assetForPlatform(release) : { platform: 'web', url: window.location.href, assetName: '' };
        latest = { version: latestVersion, native, ...destination };
        const el = banner();
        el.querySelector('#molan-update-heading').textContent = 'Molan Business update available';
        el.querySelector('#molan-update-message').textContent = native
          ? 'Version ' + latestVersion + ' is ready for ' + (destination.platform === 'android' ? 'Android' : destination.platform === 'windows' ? 'Windows' : destination.platform === 'macos' ? 'macOS' : destination.platform === 'linux' ? 'Linux' : 'your device') + '. Your current workspace and saved records remain online.'
          : 'Version ' + latestVersion + ' is available. Refresh the app to load the latest published system.';
        const apply = el.querySelector('#molan-apply-update');
        apply.textContent = native ? 'Download update ↓' : 'Update now ↻';
        el.hidden = false;
        setCheckButton('Update available ↓', true);
        if (manual) notify('A new Molan Business version is available.');
      } else {
        latest = null;
        const el = document.getElementById('molan-update-banner');
        if (el) el.hidden = true;
        setCheckButton('Check for updates ↻', false);
        if (manual) notify(current ? 'Molan Business is up to date (' + current + ').' : 'Update service reached. Reload the app if it looks outdated.');
      }
      return { ok: true, current, latest: latestVersion, updateAvailable: available };
    } catch (error) {
      setCheckButton('Retry update check ↻', false);
      if (manual) notify('Could not check for updates. Please check your internet connection and try again.');
      return { ok: false, error: error.message };
    } finally {
      busy = false;
      const button = document.getElementById('molan-update-check');
      if (button) button.disabled = false;
    }
  }

  function start() {
    mount();
    check(false);
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('focus', () => check(false));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
    timer = setInterval(() => check(false), 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.MolanUpgradeManager = Object.freeze({ check });
})();
