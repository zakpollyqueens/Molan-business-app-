/* Profile-owned interactions for Wholesale business. Shared auth/data access must remain in the root application. */
(() => {
  'use strict';
  const slug = "wholesale-business";
  const name = "Wholesale business";
  const status = document.getElementById('connection-status');
  const backend = document.getElementById('backend-state');
  const notice = document.getElementById('profile-notice');
  const manifest = JSON.parse(document.getElementById('profile-feature-manifest').textContent);
  const bridge = () => window.MolanProfileRuntime || window.MolanBusinessRuntime || null;
  function setStatus() {
    const runtime = bridge();
    if (runtime && typeof runtime.openFeature === 'function') {
      status.textContent = 'Application runtime detected';
      backend.textContent = 'Runtime ready';
      document.body.dataset.runtime = 'ready';
    } else {
      status.textContent = 'Page ready · application bridge not detected';
      backend.textContent = 'Not connected';
      document.body.dataset.runtime = 'missing';
    }
  }
  function openFeature(button) {
    const feature = manifest.find(item => item.id === button.dataset.featureId);
    if (!feature) return;
    const runtime = bridge();
    if (!runtime || typeof runtime.openFeature !== 'function') {
      notice.textContent = 'The page is loaded, but the shared Molan Business navigation/backend bridge is not connected in this standalone preview. No data was changed. Open this profile through the authenticated application while integration is being completed.';
      notice.dataset.state = 'warning';
      setStatus();
      return;
    }
    try {
      const result = runtime.openFeature({ profile: slug, profileName: name, feature });
      if (result && typeof result.catch === 'function') result.catch(error => {
        notice.textContent = 'Could not open ' + feature.title + ': ' + (error.message || 'Please try again.');
        notice.dataset.state = 'error';
      });
    } catch (error) {
      notice.textContent = 'Could not open ' + feature.title + ': ' + (error.message || 'Please try again.');
      notice.dataset.state = 'error';
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-feature-id]');
    if (button) { event.preventDefault(); openFeature(button); return; }
    if (event.target.closest('[data-profile-action="refresh"]')) {
      setStatus();
      notice.textContent = 'Connection status refreshed. Feature routes and backend permissions must be verified in the authenticated app.';
      notice.dataset.state = '';
    }
  });
  window.addEventListener('molan:runtime-ready', setStatus);
  setStatus();
})();
