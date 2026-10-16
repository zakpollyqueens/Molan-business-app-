/* Shared profile loader/route bridge. Auth remains in the main application. */
(() => {
  const root = 'business-profiles/';
  let registryPromise;
  const safeSlug = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''));
  async function registry() {
    if (!registryPromise) registryPromise = fetch(root + 'registry.json?ts=' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Profile registry could not be loaded.'); return r.json(); })
      .then(data => {
        if (!data || data.schemaVersion !== 1 || !Array.isArray(data.profiles)) throw new Error('Profile registry format is invalid.');
        return data;
      }).catch(err => { registryPromise = null; throw err; });
    return registryPromise;
  }
  async function getProfile(slug) {
    if (!safeSlug(slug)) throw new Error('Invalid business profile identifier.');
    const data = await registry();
    const entry = data.profiles.find(p => p.slug === slug && p.enabled !== false);
    if (!entry) throw new Error('This business profile is not registered or enabled.');
    const response = await fetch(root + slug + '/profile.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('The selected business profile configuration is unavailable.');
    const profile = await response.json();
    if (profile.slug !== slug || !Array.isArray(profile.features)) throw new Error('Business profile configuration failed validation.');
    return profile;
  }
  function navigate(page, options = {}) {
    if (typeof page !== 'string' || !/^[a-z0-9-]+$/.test(page)) return false;
    if (typeof window.MolanNavigate === 'function') { window.MolanNavigate(page, options); return true; }
    document.dispatchEvent(new CustomEvent('molan:navigate', { detail: { page, ...options } }));
    return false;
  }
  window.MolanProfileRuntime = Object.assign(window.MolanProfileRuntime || {}, { registry, getProfile, navigate, safeSlug });
})();