/* Shared platform configuration for every Molan Business profile. */
(() => {
  const config = Object.freeze({
    appName: 'Molan Business',
    versionManifest: 'version.json',
    profileRegistry: 'business-profiles/registry.json',
    sharedRoot: 'shared/',
    authOwnedByMainApp: true
  });
  window.MolanPlatform = Object.assign(window.MolanPlatform || {}, { config });
})();