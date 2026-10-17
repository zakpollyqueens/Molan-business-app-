(() => {
  'use strict';
  // Device access is launched from authenticated Business Settings, never from a profile hamburger.
  // Remove legacy links from static profile pages, including menus rebuilt after load.
  const cleanLegacyMenu = () => {
    document.querySelectorAll('[data-profile-menu] nav [data-give-device-access], [data-profile-menu] nav a[href="#give-device-access"]').forEach(item => item.remove());
  };
  cleanLegacyMenu();
  let menuObserverStarted = false;
  const startMenuCleanup = () => {
    cleanLegacyMenu();
    if (document.body && !menuObserverStarted) {
      new MutationObserver(cleanLegacyMenu).observe(document.body, { childList: true, subtree: true });
      menuObserverStarted = true;
    }
  };
  startMenuCleanup();
  if (!menuObserverStarted) document.addEventListener('DOMContentLoaded', startMenuCleanup, { once: true });
})();
