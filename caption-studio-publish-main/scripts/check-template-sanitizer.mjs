import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const root = path.resolve(import.meta.dirname, '..');
const source = (await fs.readFile(
  path.join(root, 'src', 'components', 'dashboard', 'basicTemplateInline.js'),
  'utf8',
)).replace(/^\s*export\s+/gm, '');
const exportRendererSource = await fs.readFile(
  path.join(root, 'scripts', 'render_template_overlay.mjs'),
  'utf8',
);

for (const required of [
  'const allowedTags = new Set',
  'await page.setRequestInterception(true)',
  'PUPPETEER_DISABLE_SANDBOX is forbidden in production',
  'Template markup contains unsafe elements or attributes',
]) {
  const haystack = required.startsWith('Template markup')
    ? await fs.readFile(path.join(root, 'backend', 'main.py'), 'utf8')
    : exportRendererSource;
  if (!haystack.includes(required)) {
    throw new Error(`Export renderer security control is missing: ${required}`);
  }
}

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: source });
  const result = await page.evaluate(() => {
    const malicious = `
      <div class="btcard t-1" onclick="window.__xss=1">
        <script>window.__xss=2<\/script>
        <svg><a href="java&#x73;cript:window.__xss=3">bad</a></svg>
        <img src=x onerror="window.__xss=4">
        <span class="word" style="animation-delay:120ms;background-image:url(https://attacker.invalid/x)">safe</span>
      </div>`;
    const sanitized = sanitizeAppliedTemplateMarkup(malicious, true);
    const host = document.createElement('div');
    host.innerHTML = sanitized;
    document.body.appendChild(host);
    host.querySelectorAll('*').forEach((node) => node.click?.());
    return {
      sanitized,
      executed: window.__xss || 0,
      dangerousNodeCount: host.querySelectorAll('script,svg,a,img,iframe,object,embed').length,
      eventAttributeCount: Array.from(host.querySelectorAll('*')).reduce(
        (count, node) => count + Array.from(node.attributes).filter((attr) => /^on/i.test(attr.name)).length,
        0,
      ),
      safeWordPresent: Boolean(host.querySelector('.btcard .word')),
      safeDelayPreserved: host.querySelector('.word')?.style.animationDelay === '120ms',
      externalStyleRemoved: !host.querySelector('.word')?.style.backgroundImage,
    };
  });
  if (result.executed || result.dangerousNodeCount || result.eventAttributeCount) {
    throw new Error(`Template sanitizer left executable markup: ${JSON.stringify(result)}`);
  }
  if (!result.safeWordPresent || !result.safeDelayPreserved || !result.externalStyleRemoved) {
    throw new Error(`Template sanitizer broke its safe allowlist: ${JSON.stringify(result)}`);
  }
  console.log('Template sanitizer security checks passed.');
} finally {
  await browser.close();
}
