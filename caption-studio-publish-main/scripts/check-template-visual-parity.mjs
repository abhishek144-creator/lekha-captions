import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

const projectRoot = path.resolve(new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function fail(message) {
  throw new Error(`Template visual parity failed: ${message}`);
}

function sanitizeHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
    .replace(/<!-- saved from url=.*?-->\s*/gi, '');
}

async function resolveChromeExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }

  return undefined;
}

async function auditTemplateAsset(page, { name, html, cardSelector, blockSelector, expectedCards }) {
  await page.setContent(sanitizeHtml(html), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());

  const result = await page.evaluate(({ cardSelector, blockSelector }) => {
    const isVisibleText = (element) => {
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize || '0');
      return rect.width > 0
        && rect.height > 0
        && fontSize > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number.parseFloat(style.opacity || '1') > 0;
    };

    const cards = Array.from(document.querySelectorAll(cardSelector));
    const failures = [];
    const summaries = cards.map((card, cardIndex) => {
      const cardId = card.id
        || card.querySelector('.tcard-id, .lk-cid, .cid')?.textContent?.trim()
        || card.className
        || `card-${cardIndex + 1}`;
      const blocks = Array.from(card.querySelectorAll(blockSelector));
      let visiblePhaseCount = 0;
      let textPhaseCount = 0;
      let motionPhaseCount = 0;

      blocks.forEach((block, blockIndex) => {
        blocks.forEach((candidate) => {
          candidate.classList.remove('active');
          candidate.style.opacity = '0';
          candidate.style.visibility = 'hidden';
        });
        block.classList.add('active');
        block.style.opacity = '1';
        block.style.visibility = 'visible';
        block.style.display = window.getComputedStyle(block).display === 'none' ? 'flex' : block.style.display;

        const rect = block.getBoundingClientRect();
        const textElements = Array.from(block.querySelectorAll(
          '.w, .word, .wbw-word, .sw, .sw-w, .plain-s, .cap-text, .cpt-wrap, .cpt-row-sm, .cpt-row-lg, .lekha-template-fit, .split-top, .split-bot, .reveal-txt, .drop-txt, .slide-crash, .ticker-txt',
        ));
        textElements.forEach((element) => {
          element.style.opacity = '1';
          element.style.visibility = 'visible';
          element.style.transform = 'none';
          element.style.filter = 'none';
          element.style.clipPath = 'inset(0 0 0 0)';
        });
        block.getAnimations({ subtree: true }).forEach((animation) => {
          try {
            animation.finish();
          } catch {
            // Some animation objects cannot be finished; explicit final-state
            // styles above still let us audit whether the phase can render text.
          }
        });
        const hasVisibleText = textElements.some(isVisibleText) || isVisibleText(block);
        const hasMotionMarkup = !!block.querySelector(
          '.wbw, .wbw-line, .sw-line, .sw, .sw-w, .word, .kf-word, [data-anim], [class*="pos"], [class*="imp-"], [class*="neon-"]',
        );

        if (rect.width > 0 && rect.height > 0) visiblePhaseCount += 1;
        if (hasVisibleText) textPhaseCount += 1;
        if (hasMotionMarkup) motionPhaseCount += 1;

        if (!hasVisibleText) {
          failures.push(`${cardId} phase ${blockIndex + 1} has no visible text`);
        }
      });

      return {
        cardId,
        phaseCount: blocks.length,
        visiblePhaseCount,
        textPhaseCount,
        motionPhaseCount,
      };
    });

    return { cardCount: cards.length, summaries, failures };
  }, { cardSelector, blockSelector });

  if (result.cardCount !== expectedCards) {
    fail(`${name} rendered ${result.cardCount} cards instead of ${expectedCards}`);
  }

  const emptyCards = result.summaries.filter((summary) => summary.phaseCount < 1);
  if (emptyCards.length) {
    fail(`${name} has cards with no phases: ${emptyCards.map((card) => card.cardId).join(', ')}`);
  }

  if (result.failures.length) {
    fail(`${name} visual audit found invisible phases:\n${result.failures.slice(0, 20).join('\n')}`);
  }

  return result;
}

const [advancedHtml, legacyHtml] = await Promise.all([
  fs.readFile(path.join(projectRoot, 'src/assets/lekha-captions-T11-T35.html'), 'utf8'),
  fs.readFile(path.join(projectRoot, 'src/assets/lekha-captions-20-templates.html'), 'utf8'),
]);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: await resolveChromeExecutable(),
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  const audits = [];
  audits.push(await auditTemplateAsset(page, {
    name: 'advanced right templates',
    html: advancedHtml,
    cardSelector: '.tcard',
    blockSelector: '.sblock',
    expectedCards: 30,
  }));
  audits.push(await auditTemplateAsset(page, {
    name: 'right basic templates',
    html: advancedHtml,
    cardSelector: '.btcard',
    blockSelector: '.bt-cap-block',
    expectedCards: 20,
  }));
  audits.push(await auditTemplateAsset(page, {
    name: 'left legacy templates',
    html: legacyHtml,
    cardSelector: '.card',
    blockSelector: '.sb',
    expectedCards: 20,
  }));
  const totalCards = audits.reduce((sum, audit) => sum + audit.cardCount, 0);
  const totalPhases = audits.reduce(
    (sum, audit) => sum + audit.summaries.reduce((phaseSum, summary) => phaseSum + summary.phaseCount, 0),
    0,
  );
  console.log(`Template visual audit passed for ${totalCards} cards and ${totalPhases} rendered phases.`);
} finally {
  await browser.close();
}
