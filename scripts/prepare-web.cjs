const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'www');
const fileExtensions = new Set([
  '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.webp',
  '.svg', '.ico', '.json', '.webmanifest', '.woff', '.woff2', '.ttf'
]);
const excludedFiles = new Set([
  'package.json', 'package-lock.json', 'capacitor.config.json',
  'tsconfig.json'
]);
const assetDirectories = ['assets', 'images', 'fonts', 'static', 'shared', 'business-profiles'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile() || excludedFiles.has(entry.name)) continue;
  if (fileExtensions.has(path.extname(entry.name).toLowerCase())) {
    fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
  }
}

for (const directory of assetDirectories) {
  const source = path.join(root, directory);
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    fs.cpSync(source, path.join(output, directory), { recursive: true });
  }
}

// Repair the published HTML itself, not only the shared runtime. Some profile navigation
// scripts rebuild <nav> with replaceChildren(), so every published profile page gets
// one canonical access item inside its actual hamburger and a correct relative script URL.
const walkHtml = directory => {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) files.push(full);
  }
  return files;
};
const accessMenuItem = '<a href="#give-device-access" data-give-device-access><span>🔐</span><strong>Give Access to Mobile &amp; PC App</strong></a>';
const profileHtmlFiles = walkHtml(path.join(output, 'business-profiles'));
let repairedProfilePages = 0;
for (const file of profileHtmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('data-profile-hamburger')) continue; // retired redirects/legacy landing pages
  const relativePage = path.relative(output, file).split(path.sep).join('/');
  const menuNav = /(\<aside\b[^>]*\bdata-profile-menu\b[^>]*>[\s\S]*?\<nav\b[^>]*>)([\s\S]*?)(\<\/nav\s*>)/i;
  const match = html.match(menuNav);
  if (!match) throw new Error('Profile hamburger exists but its menu navigation is missing: ' + relativePage);
  let navContents = match[2].replace(/<a\b(?=[^>]*\bdata-give-device-access\b)[^>]*>[\s\S]*?<\/a\s*>/gi, '');
  // Put the action after the final business-profile feature in the hamburger.
  navContents = navContents.replace(/^\s*/, '') + accessMenuItem;
  html = html.replace(menuNav, match[1] + navContents + match[3]);

  // The profile's own navigation-sync script rebuilds the nav asynchronously. Keep Give Access last there too.
  html = html.replace('nav.append(access);const home=', 'const home=');
  html = html.replace('nav.append(a)})}).catch(e=>console.warn(\'[Molan Business] Profile navigation sync failed:\',e.message));',
    'nav.append(a)});nav.append(access)}).catch(e=>console.warn(\'[Molan Business] Profile navigation sync failed:\',e.message));');

  const pageDirectory = path.posix.dirname(relativePage);
  const runtimeSrc = path.posix.relative(pageDirectory, 'shared/profile-device-access.js');
  const runtimeTag = '<script data-profile-device-access src="' + runtimeSrc + '?v=20261017-2"></script>';
  const runtimeTagPattern = /<script\b(?=[^>]*\bdata-profile-device-access\b)[^>]*>[\s\S]*?<\/script\s*>/gi;
  if (runtimeTagPattern.test(html)) {
    runtimeTagPattern.lastIndex = 0;
    let first = true;
    html = html.replace(runtimeTagPattern, () => {
      if (!first) return '';
      first = false;
      return runtimeTag;
    });
  } else {
    if (!/<\/body\s*>/i.test(html)) throw new Error('Profile page has no closing body tag for device-access runtime: ' + relativePage);
    html = html.replace(/<\/body\s*>/i, runtimeTag + '</body>');
  }
  fs.writeFileSync(file, html);

  const verifiedNav = html.match(menuNav);
  const accessCount = verifiedNav ? (verifiedNav[2].match(/data-give-device-access/g) || []).length : 0;
  if (accessCount !== 1) {
    throw new Error('Expected exactly one Give Access item inside the hamburger nav, found ' + accessCount + ': ' + relativePage);
  }
  const runtimeTags = [...html.matchAll(/<script\b(?=[^>]*\bdata-profile-device-access\b)[^>]*src=["']([^"']+)["'][^>]*>/gi)];
  if (runtimeTags.length !== 1 || runtimeTags[0][1].split('?')[0] !== runtimeSrc || !runtimeTags[0][1].includes('v=20261017-2')) {
    throw new Error('Expected one correctly linked device-access runtime (' + runtimeSrc + '): ' + relativePage);
  }
  const resolvedRuntime = path.resolve(output, path.dirname(relativePage), runtimeSrc);
  if (!fs.existsSync(resolvedRuntime)) {
    throw new Error('Device-access runtime URL does not resolve from profile page: ' + relativePage + ' -> ' + runtimeSrc);
  }
  repairedProfilePages++;
}
console.log('Repaired device-access menu/runtime in ' + repairedProfilePages + ' published profile pages.');

// Verify the complete business-profile catalogue and its device-access runtime
// are actually copied into the public site/package, not just present in source.
for (const required of [
  'business-profiles/registry.json',
  'shared/profile-device-access.js'
]) {
  if (!fs.existsSync(path.join(output, required))) {
    throw new Error('Required published profile asset missing: ' + required);
  }
}
const registry = JSON.parse(fs.readFileSync(path.join(output, 'business-profiles/registry.json'), 'utf8'));
for (const profile of registry.profiles || []) {
  if (profile.retired) continue;
  const relativePage = profile.page || `business-profiles/${profile.slug}/index.html`;
  const publishedPage = path.join(output, relativePage);
  if (!fs.existsSync(publishedPage)) {
    throw new Error('Business profile page was not included in public build: ' + relativePage);
  }
  const html = fs.readFileSync(publishedPage, 'utf8');
  for (const marker of ['data-profile-hamburger', 'data-profile-device-access', 'data-give-device-access']) {
    if (!html.includes(marker)) {
      throw new Error('Business profile is missing Give Access markup/runtime marker ' + marker + ': ' + relativePage);
    }
  }
}

// Install the same Support launcher on every published HTML page, including generated business profiles.
const allPublishedHtml = walkHtml(output);
let supportLauncherPages = 0;
for (const file of allPublishedHtml) {
  let html = fs.readFileSync(file, 'utf8');
  const relativePage = path.relative(output, file).split(path.sep).join('/');
  const pageDirectory = path.posix.dirname(relativePage);
  const runtimeSrc = path.posix.relative(pageDirectory, 'shared/support-launcher.js');
  const tag = '<script data-molan-support-launcher src="' + runtimeSrc + '"></script>';
  if (!html.includes('data-molan-support-launcher')) {
    if (!html.includes('</body>')) continue;
    html = html.replace('</body>', tag + '</body>');
  } else {
    const tagStart = html.indexOf('<script data-molan-support-launcher');
    const tagEnd = html.indexOf('</script>', tagStart);
    if (tagStart < 0 || tagEnd < 0) throw new Error('Malformed Support launcher tag: ' + relativePage);
    html = html.slice(0, tagStart) + tag + html.slice(tagEnd + 9);
  }
  fs.writeFileSync(file, html);
  if (html.split('data-molan-support-launcher').length - 1 !== 1) throw new Error('Expected one Support launcher in ' + relativePage);
  const resolvedRuntime = path.resolve(output, path.dirname(relativePage), runtimeSrc);
  if (!fs.existsSync(resolvedRuntime)) throw new Error('Support launcher URL does not resolve: ' + relativePage + ' -> ' + runtimeSrc);
  supportLauncherPages++;
}
if (!fs.existsSync(path.join(output, 'shared/support-messaging.css'))) throw new Error('Support styling is missing from published output.');
console.log('Installed and verified Support launcher on ' + supportLauncherPages + ' published HTML pages.');

const versionPath = path.join(output, 'version.json');
if (fs.existsSync(versionPath)) {
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  const buildNumber = Number.parseInt(process.env.GITHUB_RUN_NUMBER || '', 10);
  if (Number.isInteger(buildNumber) && buildNumber > 0) {
    // Keep the packaged frontend and its manifest on exactly the same version.
    const buildVersion = '1.0.' + buildNumber;
    version.currentVersion = buildVersion;
    version.version = buildVersion;
    version.buildNumber = buildNumber;
    version.buildCommit = process.env.GITHUB_SHA || 'local';
    const htmlPath = path.join(output, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const versionAssignment = /window\.MOLAN_APP_VERSION\s*=\s*["'][^"']+["'];/;
    if (!versionAssignment.test(html)) {
      throw new Error('Could not inject the packaged app version into index.html.');
    }
    html = html.replace(versionAssignment, 'window.MOLAN_APP_VERSION = "' + buildVersion + '";');
    fs.writeFileSync(htmlPath, html);
  }
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');
}

for (const required of ['index.html', 'styles.css', 'app.js', 'enhancements.js', 'version.json']) {
  if (!fs.existsSync(path.join(output, required))) {
    throw new Error('Required Molan Business frontend file missing: ' + required);
  }
}
console.log('Prepared Molan Business web assets in www/.');
