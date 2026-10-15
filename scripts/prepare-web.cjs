const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'www');
const fileExtensions = new Set([
  '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.webp',
  '.svg', '.ico', '.json', '.woff', '.woff2', '.ttf'
]);
const excludedFiles = new Set([
  'package.json', 'package-lock.json', 'capacitor.config.json',
  'tsconfig.json'
]);
const assetDirectories = ['assets', 'images', 'fonts', 'static'];

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

const versionPath = path.join(output, 'version.json');
if (fs.existsSync(versionPath)) {
  const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  const buildNumber = Number.parseInt(process.env.GITHUB_RUN_NUMBER || '', 10);
  if (Number.isInteger(buildNumber) && buildNumber > 0) {
    version.currentVersion = '1.0.' + buildNumber;
    version.buildNumber = buildNumber;
    version.buildCommit = process.env.GITHUB_SHA || 'local';
  }
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');
}

for (const required of ['index.html', 'styles.css', 'app.js', 'enhancements.js', 'version.json']) {
  if (!fs.existsSync(path.join(output, required))) {
    throw new Error('Required Molan Business frontend file missing: ' + required);
  }
}
console.log('Prepared Molan Business web assets in www/.');
