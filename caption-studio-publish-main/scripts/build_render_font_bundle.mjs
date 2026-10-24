import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { googleFontFamilyParam } from './render_font_axes.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputPath = path.resolve(process.argv[2] || path.join(root, '.render_fonts', 'fonts.css'));
const sourcePaths = [
  'src/styles/captionTemplates.css',
  'src/styles/captionTemplatesAdvanced.css',
  'src/assets/lekha-captions-T11-T35.html',
  'src/assets/lekha-captions-20-templates.html',
  'src/assets/lekha-captions-lc-2.html',
  'src/assets/lekha-captions-lc-3.html',
  'src/assets/lekha-captions-lc-4.html',
  'src/assets/lekha-captions-lc-5.html',
  'src/assets/lekha-captions-lc-studio.html',
  'src/assets/lekha-captions-lc-picks.html',
];
const systemFamilies = new Set([
  'arial', 'cursive', 'fantasy', 'inherit', 'initial', 'monospace', 'sans-serif',
  'serif', 'system-ui', 'unset', 'ui-monospace',
]);
// Installed in the image (backend/flat_fonts, apt). Poppins, Mukta and
// Rajdhani are installed in only one or two weights, so they are bundled with
// every weight instead: a template's bold keyword drawn from a synthesized bold
// is narrower than the editor's real one and moves the words around it.
const packagedFamilies = new Set([
  'baloo 2', 'baloo bhai 2', 'baloo da 2', 'baloo tamma 2', 'catamaran', 'inter',
  'kalam', 'mandali', 'manjari', 'marcellus', 'montserrat', 'mukta mahee',
  'mukta malar', 'noto sans', 'noto sans bengali', 'noto sans devanagari',
  'noto sans kannada', 'noto sans malayalam', 'noto sans telugu', 'roboto',
]);
const ALWAYS_BUNDLED_FAMILIES = ['Mukta', 'Poppins', 'Rajdhani'];

const source = (await Promise.all(sourcePaths.map((item) => fs.readFile(path.join(root, item), 'utf8'))))
  .join('\n')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"');
const families = new Set(ALWAYS_BUNDLED_FAMILIES);
for (const match of source.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
  const family = String(match[1] || '').split(',')[0].replace(/(?:!important|["'])/gi, '').trim();
  const normalized = family.toLowerCase();
  if (family && !systemFamilies.has(normalized) && !packagedFamilies.has(normalized) && !family.startsWith('var(')) {
    families.add(family);
  }
}

const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36';
const fontAssets = new Map();
const cssParts = [];
for (const family of [...families].sort()) {
  const response = await fetch(`https://fonts.googleapis.com/css2?${googleFontFamilyParam(family)}&display=swap`, {
    headers: { 'user-agent': userAgent },
  });
  if (!response.ok) throw new Error(`Google Fonts CSS failed for ${family}: ${response.status}`);
  cssParts.push(await response.text());
}
let css = cssParts.join('\n');
for (const match of css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
  const url = match[1];
  if (fontAssets.has(url)) continue;
  const response = await fetch(url, { headers: { 'user-agent': userAgent } });
  if (!response.ok) throw new Error(`Google Fonts asset failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'font/woff2';
  fontAssets.set(url, `data:${contentType};base64,${bytes.toString('base64')}`);
}
for (const [url, dataUrl] of fontAssets) css = css.split(url).join(dataUrl);
if (!css.includes('@font-face') || fontAssets.size === 0) throw new Error('Render font bundle is empty');

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, css, 'utf8');
const manifest = {
  schema: 1,
  families: [...families].sort(),
  assetCount: fontAssets.size,
  sha256: crypto.createHash('sha256').update(css).digest('hex'),
};
await fs.writeFile(`${outputPath}.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Bundled ${manifest.families.length} render font families (${manifest.assetCount} assets, ${manifest.sha256})`);
