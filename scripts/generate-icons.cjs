const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets');
const source = path.join(assets, 'molan-business-icon.svg');

async function main() {
  fs.mkdirSync(assets, { recursive: true });
  const svg = fs.readFileSync(source);
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(assets, 'icon.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(assets, 'icon-512.png'));
  await sharp(svg).resize(192, 192).png().toFile(path.join(assets, 'icon-192.png'));

  const foreground = await sharp(svg).resize(1120, 1120).png().toBuffer();
  const splashBackground = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="2732" height="2732" fill="#081a35"/><circle cx="1366" cy="1366" r="900" fill="#0b3155" opacity=".65"/></svg>');
  await sharp(splashBackground).composite([{ input: foreground, left: 806, top: 806 }]).png().toFile(path.join(assets, 'splash.png'));
  console.log('Generated Molan Business icon and splash assets.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
