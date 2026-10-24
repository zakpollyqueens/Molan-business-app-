/* Cross-platform Molan Business update checker.
   Web/PWA users refresh the live site. Installed Android/desktop apps are directed to
   the matching published installer; the OS still asks the user to approve installation. */
(() => {
  const RELEASE_API = 'https://api.github.com/repos/zakpollyqueens/Molan-business-app-/releases/latest';
  const RELEASE_PAGE = 'https://github.com/zakpollyqueens/Molan-business-app-/releases/latest';
  const REMOTE_MANIFEST = 'https://zakpollyqueens.github.io/Molan-business-app-/version.json';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zakmolanitech.molanbusiness';
  let latest = null;
  let busy = false;
  let timer = null;

  const isNative = () => {
    try {
      if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return true;
      const platform = String(window.Capacitor?.getPlatform?.() || '').toLowerCase();
      if (['android', 'ios'].includes(platform)) return true;
      return /^(capacitor|ionic):$/i.test(window.location.protocol);
    } catch (_) { return false; }
  };
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

  function installStyles() {
    if (document.getElementById('molan-updater-styles')) return;
    const style = document.createElement('style'); style.id = 'molan-updater-styles';
    style.textContent = '.molan-update-banner{position:fixed;z-index:99999;left:50%;bottom:18px;transform:translateX(-50%);width:min(620px,calc(100vw - 24px));display:flex;align-items:center;gap:16px;padding:16px 18px;border:1px solid #3e6e91;border-radius:18px;background:linear-gradient(135deg,#071a35f7,#12365af7);color:#f4fbff;box-shadow:0 18px 60px #00152c66;backdrop-filter:blur(18px)}.molan-update-banner[hidden]{display:none!important}.molan-update-copy{flex:1;min-width:0}.molan-update-copy strong{display:block;font-size:15px}.molan-update-copy p{margin:5px 0 0;color:#c6d9e9;font-size:12px;line-height:1.5}.molan-update-banner .button{white-space:nowrap}.molan-update-progress{height:6px;overflow:hidden;border-radius:99px;background:#ffffff20;margin-top:11px}.molan-update-progress>span{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#55d8f0,#5b9dff);transition:width .12s linear}.molan-update-percent{font-size:11px;color:#8feaff;margin-top:5px;display:block}@media(max-width:520px){.molan-update-banner{align-items:stretch;flex-direction:column;gap:12px;bottom:10px}.molan-update-banner .button{width:100%;min-height:42px}}';
    document.head.appendChild(style);
  }
  function banner() {
    installStyles();
    let el = document.getElementById('molan-update-banner');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'molan-update-banner';
    el.className = 'molan-update-banner';
    el.setAttribute('role', 'status');
    el.hidden = true;
    el.innerHTML = '<div class="molan-update-copy"><strong id="molan-update-heading">Update available</strong><p id="molan-update-message">A new Molan Business release is ready.</p><div class="molan-update-progress" id="molan-update-progress" hidden><span id="molan-update-progress-fill"></span></div><small class="molan-update-percent" id="molan-update-percent" hidden>0%</small></div><button class="button primary small" id="molan-apply-update" type="button">Update now ↻</button>'
    document.querySelector('#app')?.prepend(el);
    el.querySelector('#molan-apply-update').addEventListener('click', applyUpdate);
    return el;
  }

  function setCheckButton(_label, hasUpdate = false) {
    const button = document.getElementById('refresh-button');
    if (!button) return;
    button.setAttribute('aria-label', hasUpdate ? 'Refresh workspace; an app update is available' : 'Refresh workspace and check for app updates');
    button.title = hasUpdate ? 'Refresh workspace · An app update is available below' : 'Refresh workspace and check for updates';
    button.classList.toggle('has-update', hasUpdate);
  }

  function mount() {
    // Keep the existing top-right Refresh control as the only persistent control.
    // The separate update action is shown only inside the banner when a release is available.
    const button = document.getElementById('refresh-button');
    if (!button || button.dataset.updateCheckBound === 'true') return;
    button.dataset.updateCheckBound = 'true';
    button.addEventListener('click', () => check(true));
  }

  async function fetchLatest() {
    let apiFailure = 'GitHub release service unavailable';
    try {
      const response = await fetch(RELEASE_API, {
        cache: 'no-store',
        headers: { 'Accept': 'application/vnd.github+json', 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) {
        apiFailure = response.status === 403 || response.status === 429
          ? 'GitHub temporarily limited update checks'
          : 'GitHub release service returned HTTP ' + response.status;
        throw new Error(apiFailure);
      }
      const release = await response.json();
      const tag = normalize(release.tag_name);
      if (!tag || !Array.isArray(release.assets)) throw new Error('The latest release response is incomplete.');
      return { version: tag, release, source: 'github-release' };
    } catch (error) {
      apiFailure = error?.message || apiFailure;
    }

    // The installed app must not depend on the GitHub API being available or
    // on the API's anonymous rate limit. Fall back to the live GitHub Pages
    // manifest, not the stale version.json bundled inside the installed APK.
    const manifestUrl = new URL(REMOTE_MANIFEST);
    manifestUrl.searchParams.set('check', String(Date.now()));
    const response = await fetch(manifestUrl.toString(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error(apiFailure + '; update manifest returned HTTP ' + response.status + '.');
    const manifest = await response.json();
    const version = normalize(manifest.releaseVersion || manifest.version || manifest.currentVersion);
    if (!version) throw new Error(apiFailure + '; update manifest has no version.');
    const tag = manifest.releaseTag || ('v' + version);
    const base = 'https://github.com/zakpollyqueens/Molan-business-app-/releases/download/' + encodeURIComponent(tag) + '/';
    const assets = Array.isArray(manifest.releaseAssets) ? manifest.releaseAssets.map(item => ({
      name: item.name || item.assetName || '',
      browser_download_url: item.browser_download_url || item.url || ''
    })) : [
      { name: 'Molan-Business.apk', browser_download_url: base + 'Molan-Business.apk' },
      { name: 'Molan-Business-Setup.exe', browser_download_url: base + 'Molan-Business-Setup.exe' },
      { name: 'Molan.Business-' + version + '.dmg', browser_download_url: base + 'Molan.Business-' + version + '.dmg' },
      { name: 'Molan.Business-' + version + '.AppImage', browser_download_url: base + 'Molan.Business-' + version + '.AppImage' }
    ];
    return {
      version,
      source: 'pages-manifest',
      release: { tag_name: tag, html_url: manifest.releasePage || RELEASE_PAGE, assets }
    };
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
    // Every installed Android app must update through the trusted Google Play
    // listing. Never install an APK directly from GitHub releases from inside the app.
    if (platform === 'android') {
      return { platform, url: PLAY_STORE_URL, assetName: '', storeListing: true };
    }
    const asset = assets.find(item => patterns[platform]?.test(item.name));
    return { platform, url: asset?.browser_download_url || '', assetName: asset?.name || '', storeListing: false };
  }

  function showDownloadProgress(percent, message) {
    const el = document.getElementById('molan-update-banner'); if (!el) return;
    const progress = el.querySelector('#molan-update-progress'), fill = el.querySelector('#molan-update-progress-fill'), label = el.querySelector('#molan-update-percent'), msg = el.querySelector('#molan-update-message');
    if (progress) progress.hidden = false; if (label) { label.hidden = false; label.textContent = Math.max(0, Math.min(100, Math.round(percent))) + '%'; }
    if (fill) fill.style.width = Math.max(0, Math.min(100, percent)) + '%'; if (msg && message) msg.textContent = message;
  }

  async function downloadWithProgress(url, filename) {
    const response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error('No readable download stream');
    const total = Number(response.headers.get('content-length')) || 0, reader = response.body.getReader(), chunks = []; let received = 0;
    while (true) { const part = await reader.read(); if (part.done) break; chunks.push(part.value); received += part.value.byteLength;
      showDownloadProgress(total ? received / total * 100 : 0, total ? 'Downloading ' + filename + '…' : 'Downloading update… ' + (received / 1048576).toFixed(1) + ' MB received'); }
    if (!received) throw new Error('Downloaded file is empty'); showDownloadProgress(100, 'Download complete. Preparing installer…');
    const objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'application/octet-stream' })), a = document.createElement('a');
    a.href = objectUrl; a.download = filename; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }

  let directDownloadFallback = false;
  async function applyUpdate() {
    if (!latest || busy) return; const button = document.getElementById('molan-apply-update');
    if (latest.storeListing && latest.url) {
      notify('Opening the official Google Play listing so you can update Molan Business.');
      window.location.href = latest.url;
      return;
    }
    if (directDownloadFallback && latest.url) { window.location.href = latest.url; return; }
    if (!latest.native) { if (button) { button.disabled = true; button.textContent = 'Refreshing…'; } const url = new URL(window.location.href); url.searchParams.set('molan_release', latest.version); url.searchParams.set('refresh', String(Date.now())); window.location.replace(url.toString()); return; }
    if (!latest.url || !latest.assetName) { notify('The latest release does not include an installer for this device.'); return; }
    if (button) { button.disabled = true; button.textContent = 'Downloading…'; } const el = document.getElementById('molan-update-banner');
    if (el) el.querySelector('#molan-update-heading').textContent = 'Downloading Molan Business';
    directDownloadFallback = false;
    showDownloadProgress(0, 'Connecting to the download server…');
    try { await downloadWithProgress(latest.url, latest.assetName); showDownloadProgress(100, 'Download complete. Open the downloaded installer to finish updating.');
      if (el) el.querySelector('#molan-update-heading').textContent = 'Update downloaded'; if (button) { button.disabled = false; button.textContent = 'Download again ↓'; }
      notify('Update downloaded. Open the installer and approve installation to complete the update.');
      // The floater is temporary: close it after a completed download. On the next
      // launch, the version check will keep it hidden if installation succeeded.
      window.setTimeout(() => { const completed = document.getElementById('molan-update-banner'); if (completed) completed.hidden = true; }, 1800);
    } catch (error) {
      directDownloadFallback = true;
      if (button) { button.disabled = false; button.textContent = 'Open download ↗'; }
      showDownloadProgress(0, 'This device cannot show in-app download progress for this file. Tap “Open download” to download it from the official release.');
      if (el) el.querySelector('#molan-update-heading').textContent = 'Continue update download';
      notify('The update is available. Use Open download to continue through the official release host.');
      console.warn('[Molan Business updater] In-app download failed:', error?.message || error);
    }
  }

  async function check(manual = false) {
    if (busy) return;
    busy = true;
    const button = document.getElementById('refresh-button');
    if (button) button.setAttribute('aria-busy', 'true');
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
        el.querySelector('#molan-update-message').textContent = destination.storeListing
          ? 'Version ' + latestVersion + ' is available. Open Google Play to update Molan Business to the latest official release.'
          : native
            ? 'Version ' + latestVersion + ' is ready for ' + (destination.platform === 'windows' ? 'Windows' : destination.platform === 'macos' ? 'macOS' : destination.platform === 'linux' ? 'Linux' : 'your device') + '. Your current workspace and saved records remain online.'
            : 'Version ' + latestVersion + ' is available. Refresh the app to load the latest published system.';
        const apply = el.querySelector('#molan-apply-update');
        apply.textContent = destination.storeListing ? 'Update now ↗' : native ? 'Download update ↓' : 'Update now ↻';
        el.hidden = false;
        setCheckButton('', true);
        if (manual) notify('A new Molan Business version is available.');
      } else {
        latest = null;
        const el = document.getElementById('molan-update-banner');
        if (el) el.hidden = true;
        setCheckButton('', false);
        if (manual) notify(current ? 'Molan Business is up to date (' + current + ').' : 'Update service reached. Reload the app if it looks outdated.');
      }
      return { ok: true, current, latest: latestVersion, updateAvailable: available };
    } catch (error) {
      setCheckButton('', false);
      if (manual) notify('Could not check updates from GitHub or the live update manifest. Check your connection and tap Refresh to retry.');
      return { ok: false, error: error.message };
    } finally {
      busy = false;
      const button = document.getElementById('refresh-button');
      if (button) button.removeAttribute('aria-busy');
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
