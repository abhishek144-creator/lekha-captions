import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import {
  KEYFRAME_ADVANCED_TEMPLATE_IDS,
  ORIGINAL_TEMPLATE_BLOCKS,
  getKeyframeTemplateMotionWindowMs,
} from '../src/components/dashboard/templateMotionConfig.js';

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

// T41–T52 are animated only by CSS keyframes. Inject real-length captions
// (Latin and Indic, 1–14 words) into every phase and check that the settled
// frame is fully visible, wraps inside 88% of the stage, never splits a word,
// and that the authored schedule fits the export sampling window.
const KEYFRAME_AUDIT_CAPTIONS = [
  ['Yes'],
  ['Every', 'small', 'step', 'adds', 'up', 'to', 'something'],
  ['Long', 'captions', 'must', 'still', 'wrap', 'cleanly', 'inside', 'the', 'stage', 'without', 'clipping', 'any', 'single', 'word'],
  ['आज', 'हम', 'एक', 'नई', 'कहानी', 'शुरू', 'करते', 'हैं'],
  ['నేను', 'ఈ', 'రోజు', 'చాలా', 'సంతోషంగా', 'ఉన్నాను'],
];

async function auditKeyframeTemplates(page, html) {
  await page.setContent(sanitizeHtml(html).replace(/@import url\([^)]*\);/g, ''), { waitUntil: 'domcontentloaded' });
  const failures = [];
  let cases = 0;
  for (const templateId of KEYFRAME_ADVANCED_TEMPLATE_IDS) {
    const phaseCount = (ORIGINAL_TEMPLATE_BLOCKS[templateId] || []).length;
    for (let phaseIndex = 0; phaseIndex < phaseCount; phaseIndex += 1) {
      for (const words of KEYFRAME_AUDIT_CAPTIONS) {
        cases += 1;
        const windowMs = getKeyframeTemplateMotionWindowMs(templateId, words.length);
        const result = await page.evaluate(({ templateId, phaseIndex, words }) => {
          const card = document.getElementById(`card-${templateId}`);
          const stage = card.querySelector('.stage');
          const blocks = Array.from(card.querySelectorAll('.sblock'));
          blocks.forEach((block) => { block.classList.remove('active'); block.style.opacity = '0'; });
          const block = blocks[phaseIndex];
          const line = block.querySelector(`.${templateId}-line`);
          if (!line) return { error: 'missing line container' };
          const impIndex = Math.min(words.length - 1, 1);
          line.textContent = '';
          words.forEach((word, index) => {
            if (index > 0) line.appendChild(document.createTextNode(' '));
            const span = document.createElement('span');
            span.className = index === impIndex ? `w imp-${templateId} is-emphasis` : 'w';
            span.dataset.i = String(index);
            if (index === impIndex) {
              span.dataset.imp = 'true';
              span.dataset.impCls = `imp-${templateId}`;
            }
            span.textContent = word;
            line.appendChild(span);
          });
          block.style.opacity = '1';
          void block.offsetWidth;
          block.classList.add('active');
          const animations = block.getAnimations({ subtree: true });
          let naturalEndMs = 0;
          animations.forEach((animation) => {
            const timing = animation.effect.getComputedTiming();
            const looping = !Number.isFinite(timing.iterations);
            if (!looping) naturalEndMs = Math.max(naturalEndMs, timing.endTime);
            animation.pause();
            animation.currentTime = looping ? animation.effect.getTiming().delay : timing.endTime + 1;
          });
          const stageRect = stage.getBoundingClientRect();
          const lineRect = line.getBoundingClientRect();
          const problems = [];
          if (!animations.length) problems.push('no CSS animations');
          Array.from(line.querySelectorAll('.w')).forEach((word) => {
            const style = getComputedStyle(word);
            const rect = word.getBoundingClientRect();
            const lineHeight = Number.parseFloat(style.fontSize) * 1.9;
            if (Number(style.opacity) < 0.999) problems.push(`${word.textContent} opacity ${style.opacity}`);
            if (style.visibility !== 'visible') problems.push(`${word.textContent} hidden`);
            // A finished keyframe resolves `transform: none` to an identity matrix.
            const isIdentity = style.transform === 'none'
              || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(style.transform)
              || /^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\)$/.test(style.transform);
            if (!isIdentity) problems.push(`${word.textContent} transform ${style.transform}`);
            if (style.clipPath !== 'none') problems.push(`${word.textContent} clip ${style.clipPath}`);
            if (rect.height > lineHeight) problems.push(`${word.textContent} wraps inside the word`);
          });
          if (lineRect.width > stageRect.width * 0.88 + 1) {
            problems.push(`line ${Math.round(lineRect.width)}px exceeds 88% of ${Math.round(stageRect.width)}px stage`);
          }
          return { naturalEndMs, problems };
        }, { templateId, phaseIndex, words });
        const label = `${templateId} phase ${phaseIndex + 1} (${words.length} words: ${words[0]})`;
        if (result.error) failures.push(`${label}: ${result.error}`);
        else {
          result.problems.forEach((problem) => failures.push(`${label}: ${problem}`));
          if (result.naturalEndMs > windowMs + 1) {
            failures.push(`${label}: schedule ${Math.round(result.naturalEndMs)}ms outlasts export window ${windowMs}ms`);
          }
        }
      }
    }
  }
  if (failures.length) fail(`keyframe template audit failed:\n${failures.slice(0, 30).join('\n')}`);
  return { cases };
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
    expectedCards: 42,
  }));
  const keyframeAudit = await auditKeyframeTemplates(page, advancedHtml);
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
  console.log(`Keyframe template audit passed for ${keyframeAudit.cases} T41–T52 phase/caption cases.`);
} finally {
  await browser.close();
}
