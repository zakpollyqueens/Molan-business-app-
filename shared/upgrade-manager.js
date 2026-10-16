/* Shared upgrade checker. Checks the deployed manifest and offers a safe reload; it never changes user data. */
(() => {
  const MANIFEST = 'version.json';
  const STORAGE_KEY = 'molan_seen_release_v1';
  let latest = null, busy = false;
  const base = new URL('.', document.currentScript?.src || location.href);
  const manifestUrl = () => new URL(MANIFEST + '?check=' + Date.now(), base).toString();
  const readManifest = async () => {
    const response = await fetch(manifestUrl(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error('Update manifest is not available yet.');
    const value = await response.json();
    if (!value || typeof value.version !== 'string' || !value.version.trim()) throw new Error('Update manifest has no valid version.');
    return value;
  };
  function ensureBanner() {
    let banner = document.getElementById('molan-update-banner');
    if (banner) return banner;
    banner = document.createElement('section');
    banner.id = 'molan-update-banner';
    banner.className = 'molan-update-banner';
    banner.setAttribute('role', 'status');
    banner.hidden = true;
    banner.innerHTML = '<p id="molan-update-message">A new Molan Business update is ready.</p><button class="button primary small" id="molan-apply-update" type="button">Update now ↻</button>';
    const app = document.getElementById('app');
    (app || document.body).prepend(banner);
    banner.querySelector('#molan-apply-update').addEventListener('click', () => {
      if (!latest) return;
      try { localStorage.setItem(STORAGE_KEY, latest.version); } catch {}
      const url = new URL(location.href);
      url.searchParams.set('molan_release', latest.version);
      url.searchParams.set('refresh', String(Date.now()));
      location.replace(url.toString());
    });
    return banner;
  }
  function showUpdate(manifest) {
    latest = manifest;
    const banner = ensureBanner();
    const message = banner.querySelector('#molan-update-message');
    message.textContent = 'Molan Business ' + manifest.version + ' is available.' + (manifest.notes ? ' ' + manifest.notes : '');
    banner.hidden = false;
    document.querySelectorAll('#molan-update-check').forEach(b => b.classList.add('has-update'));
  }
  async function check(options = {}) {
    if (busy) return { ok: false, reason: 'busy' };
    busy = true;
    const button = document.getElementById('molan-update-check');
    button?.classList.add('is-checking');
    if (button) button.textContent = 'Checking updates…';
    try {
      const manifest = await readManifest();
      const deployed = new URL(location.href).searchParams.get('molan_release');
      let seen = '';
      try { seen = localStorage.getItem(STORAGE_KEY) || ''; } catch {}
      const current = deployed || window.MOLAN_APP_VERSION || document.documentElement.dataset.appVersion || seen;
      if (current && manifest.version !== current) showUpdate(manifest);
      else if (!current) {
        try { localStorage.setItem(STORAGE_KEY, manifest.version); } catch {}
      }
      if (button && !latest) button.textContent = 'Check for updates ↻';
      return { ok: true, version: manifest.version, updateAvailable: !!latest };
    } catch (error) {
      if (button) button.textContent = 'Retry update check ↻';
      if (options.manual) {
        const toast = document.getElementById('toast');
        if (toast) { toast.textContent = 'Could not check for updates. Please try again when online.'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3500); }
      }
      return { ok: false, error: error.message };
    } finally {
      busy = false;
      button?.classList.remove('is-checking');
    }
  }
  function mountButton() {
    if (document.getElementById('molan-update-check')) return;
    const actions = document.querySelector('.top-actions');
    if (!actions) return;
    const button = document.createElement('button');
    button.id = 'molan-update-check';
    button.type = 'button';
    button.className = 'button secondary small molan-update-check';
    button.textContent = 'Check for updates ↻';
    button.title = 'Check whether a newer Molan Business release is available';
    button.addEventListener('click', () => check({ manual: true }));
    actions.insertBefore(button, actions.firstChild);
  }
  function start() {
    mountButton();
    check();
    const observer = new MutationObserver(() => mountButton());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('focus', () => check());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(() => check(), 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.MolanUpgradeManager = { check, getLatest: () => latest };
})();