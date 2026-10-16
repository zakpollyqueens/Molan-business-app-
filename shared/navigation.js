/* Shared navigation helpers for the authenticated Molan shell. */
(() => {
  const validPage = value => typeof value === 'string' && /^[a-z0-9-]+$/.test(value);
  function go(page, source = 'shared') {
    if (!validPage(page)) return false;
    if (typeof window.MolanNavigate === 'function') { window.MolanNavigate(page, { source }); return true; }
    const nav = document.querySelector('#main-nav [data-page="' + CSS.escape(page) + '"]');
    if (nav) { nav.click(); return true; }
    document.dispatchEvent(new CustomEvent('molan:navigate', { detail: { page, source } }));
    return false;
  }
  document.addEventListener('click', event => {
    const shortcut = event.target.closest('[data-molan-route]');
    if (!shortcut) return;
    const page = shortcut.getAttribute('data-molan-route');
    if (!validPage(page)) return;
    event.preventDefault();
    go(page, 'shortcut');
  });
  window.MolanNavigation = Object.assign(window.MolanNavigation || {}, { go, validPage });
})();