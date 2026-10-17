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

// Keep profile navigation focused on navigation. Device/app access belongs in the
// authenticated workspace's Business Settings screen, not the profile hamburger.
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
const profileHtmlFiles = walkHtml(path.join(output, 'business-profiles'));
let checkedProfilePages = 0;
for (const file of profileHtmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const relativePage = path.relative(output, file).split(path.sep).join('/');
  if (!html.includes('data-profile-hamburger')) continue;
  const menuNav = /(<aside\b[^>]*\bdata-profile-menu[^>]*>[\s\S]*?<nav\b[^>]*>)([\s\S]*?)(<\/nav\s*>)/i;
  const match = html.match(menuNav);
  if (!match) throw new Error('Profile hamburger exists but its menu navigation is missing: ' + relativePage);
  if (/data-give-device-access/.test(match[2]) || /Give Access to Mobile/i.test(match[2])) {
    throw new Error('Give Access must not be placed in the profile hamburger: ' + relativePage);
  }
  checkedProfilePages++;
}
console.log('Verified ' + checkedProfilePages + ' profile hamburger menus do not contain the misplaced Give Access action.');

// Verify the complete business-profile catalogue is copied into the public site
// and that the shared app shell provides device access from Business Settings.
for (const required of [
  'business-profiles/registry.json',
  'app.js'
]) {
  if (!fs.existsSync(path.join(output, required))) {
    throw new Error('Required published business asset missing: ' + required);
  }
}
const registry = JSON.parse(fs.readFileSync(path.join(output, 'business-profiles/registry.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(output, 'app.js'), 'utf8');
if (!appSource.includes('DEVICE & APP ACCESS') || !appSource.includes('device-access-settings-panel')) {
  throw new Error('Business Settings is missing the Device & App Access section.');
}
for (const profile of registry.profiles || []) {
  if (profile.retired) continue;
  const relativePage = profile.page || `business-profiles/${profile.slug}/index.html`;
  const publishedPage = path.join(output, relativePage);
  if (!fs.existsSync(publishedPage)) {
    throw new Error('Business profile page was not included in public build: ' + relativePage);
  }
}
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
