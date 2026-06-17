import fs from 'fs/promises';
import {
  ADVANCED_TEMPLATE_RUNTIME_CSS,
  LEGACY_IMP_ANIMS,
  LEGACY_TEMPLATE_TIMING,
  LEGACY_WBW_CLASSES,
  ORIGINAL_TEMPLATE_BLOCK_TYPES,
} from '../src/components/dashboard/templateMotionConfig.js';
import {
  buildAdvancedTemplateBlockMarkupMap,
  extractCompleteTemplateDiv,
} from '../src/components/dashboard/advancedTemplateSourceUtils.js';

const projectRoot = new URL('../', import.meta.url);
const advancedSource = await fs.readFile(
  new URL('src/assets/lekha-captions-T11-T35.html', projectRoot),
  'utf8',
);
const legacySource = await fs.readFile(
  new URL('src/assets/lekha-captions-20-templates.html', projectRoot),
  'utf8',
);
const videoPlayerSource = await fs.readFile(
  new URL('src/components/dashboard/VideoPlayer.jsx', projectRoot),
  'utf8',
);
const gallerySource = await fs.readFile(
  new URL('src/components/dashboard/AdvancedTemplateLibrary.jsx', projectRoot),
  'utf8',
);
const sidebarGallerySource = await fs.readFile(
  new URL('src/components/dashboard/SidebarTemplateGallery20.jsx', projectRoot),
  'utf8',
);
const exportRendererSource = await fs.readFile(
  new URL('scripts/render_template_overlay.mjs', projectRoot),
  'utf8',
);

function fail(message) {
  throw new Error(`Template motion parity failed: ${message}`);
}

const templateStart = advancedSource.indexOf('const templates = [');
const templateEnd = advancedSource.indexOf('/* ---- INIT ALL TEMPLATES ---- */', templateStart);
if (templateStart < 0 || templateEnd < 0) fail('advanced template definitions were not found');

const sourceBlockTypes = {};
const styledBlockIds = [];
const templateRegion = advancedSource.slice(templateStart, templateEnd);
for (const match of templateRegion.matchAll(
  /\{\s*id:\s*'(t\d+)',\s*blocks:\s*\[([\s\S]*?)\]\s*\}/g,
)) {
  sourceBlockTypes[match[1]] = Array.from(
    match[2].matchAll(/type:\s*'([^']+)'/g),
    (typeMatch) => typeMatch[1],
  );
  styledBlockIds.push(
    ...Array.from(
      match[2].matchAll(/id:\s*'([^']+)',\s*type:\s*'styled'/g),
      (blockMatch) => blockMatch[1],
    ),
  );
}

for (let templateNumber = 11; templateNumber <= 40; templateNumber += 1) {
  const templateId = `t${templateNumber}`;
  const sourceTypes = sourceBlockTypes[templateId];
  const runtimeTypes = ORIGINAL_TEMPLATE_BLOCK_TYPES[templateId];
  if (!sourceTypes) fail(`${templateId} is missing from the authored source`);
  if (!runtimeTypes) fail(`${templateId} is missing from the runtime catalog`);
  if (JSON.stringify(sourceTypes) !== JSON.stringify(runtimeTypes)) {
    fail(
      `${templateId} differs: source=${sourceTypes.join(',')} runtime=${runtimeTypes.join(',')}`,
    );
  }
}

const sourceBlockMarkup = buildAdvancedTemplateBlockMarkupMap(
  advancedSource,
  ORIGINAL_TEMPLATE_BLOCK_TYPES,
);
for (const [templateId, blockTypes] of Object.entries(ORIGINAL_TEMPLATE_BLOCK_TYPES)) {
  const blocks = sourceBlockMarkup[templateId] || [];
  if (blocks.length !== blockTypes.length) {
    fail(`${templateId} source block count differs from the runtime catalog`);
  }
  blocks.forEach((block, blockIndex) => {
    if (!block.includes(`id="${templateId}-b${blockIndex}"`)) {
      fail(`${templateId} phase ${blockIndex} did not resolve to its authored source block`);
    }
  });
}

if (!gallerySource.includes("template_source: 'lekha-advanced'")) {
  fail('advanced selections do not preserve their canonical source');
}
if (!gallerySource.includes('data-template-card-id={template.id}')) {
  fail('right-side template cards do not expose stable selection IDs');
}
if (!videoPlayerSource.includes("data-template-renderer={sourceMarkup ? 'source' : 'fallback'}")) {
  fail('live advanced rendering does not expose the canonical source/fallback path');
}
if (!exportRendererSource.includes('buildCanonicalAdvancedTemplateMarkup')) {
  fail('export rendering does not use canonical advanced source blocks');
}
if (!exportRendererSource.includes(
  "'.template-caption-shell, .lekha-sidebar-export-template-shell'",
)) {
  fail('export animation seeking does not resolve both template shell types');
}
if (!exportRendererSource.includes('firstTemplateCaption')) {
  fail('export rendering cannot recover canonical template identity from captions');
}
if (!exportRendererSource.includes(
  "phase.block.style.transform = 'scale(' + Number(window.__exportCanvasScale || 1) + ')'",
)) {
  fail('left-template export phases do not scale from preview pixels to video pixels');
}
if (!exportRendererSource.includes(
  'font-family: var(--sidebar-source-font, inherit) !important',
)) {
  fail('left-template export does not inherit the preview-resolved caption font');
}
if (!exportRendererSource.includes(
  'const sidebarSampleFps = defaultTemplateSampleFps',
)) {
  fail('left-template export animation is sampled below the output frame rate');
}
if (!exportRendererSource.includes('data-caption-font-weight')) {
  fail('left-template export does not preserve the selected caption weight per phase');
}
if (!exportRendererSource.includes('data-export-caption-text="true"')) {
  fail('left-template replacement text is not tagged for preview typography parity');
}
// Preview/export parity: word colour and weight must resolve through the same
// cascade in both renderers (shell/host inline style + the template's own class
// CSS). A per-word !important force in the export flattens the dimmed-context
// alphas and bold hero tiers that the preview keeps — so its absence is the
// contract now, and the shell must mirror the preview host's inline style.
if (exportRendererSource.includes("textNode.style.setProperty('font-weight'")) {
  fail('left-template export force-flattens per-word weight (breaks preview parity)');
}
if (exportRendererSource.includes("textNode.style.setProperty('color'")) {
  fail('left-template export force-flattens per-word colour (breaks preview parity)');
}
if (!exportRendererSource.includes("+ 'color:' + escapeHtml(appliedStyle.text_color")) {
  fail('left-template shell does not mirror the preview host inline colour');
}
if (!exportRendererSource.includes("+ 'line-height:' + escapeHtml(String(appliedStyle.line_spacing")) {
  fail('left-template shell does not mirror the preview host line-height');
}

const authoredCss = advancedSource.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
for (const blockId of styledBlockIds) {
  const classSelector = `.${blockId}.active`;
  const idSelector = `#${blockId}.active`;
  const hasAuthoredMotion = authoredCss.includes(classSelector) || authoredCss.includes(idSelector);
  const hasRuntimeRepair = ADVANCED_TEMPLATE_RUNTIME_CSS.includes(classSelector)
    || ADVANCED_TEMPLATE_RUNTIME_CSS.includes(idSelector);
  if (!hasAuthoredMotion && !hasRuntimeRepair) {
    fail(`${blockId} is styled but has no active motion selector`);
  }
}

const legacyTimingChecks = [
  ['wordStaggerMs', /var WBW_DELAY\s*=\s*(\d+)/, LEGACY_TEMPLATE_TIMING.wordStaggerMs],
  ['wordDurationMs', /WBW_DUR\s*=\s*(\d+)/, LEGACY_TEMPLATE_TIMING.wordDurationMs],
  ['positionedWordStaggerMs', /var POS_STAGGER\s*=\s*(\d+)/, LEGACY_TEMPLATE_TIMING.positionedWordStaggerMs],
  ['positionedWordDurationMs', /POS_DUR\s*=\s*(\d+)/, LEGACY_TEMPLATE_TIMING.positionedWordDurationMs],
  ['holdMs', /var HOLD\s*=\s*(\d+)/, LEGACY_TEMPLATE_TIMING.holdMs],
  ['exitMs', /EXIT_MS\s*=\s*(\d+)/, LEGACY_TEMPLATE_TIMING.exitMs],
  ['gapMs', /GAP\s*=\s*(\d+)/, LEGACY_TEMPLATE_TIMING.gapMs],
];

for (const [name, pattern, runtimeValue] of legacyTimingChecks) {
  const sourceValue = Number(legacySource.match(pattern)?.[1]);
  if (!Number.isFinite(sourceValue)) fail(`legacy ${name} was not found`);
  if (sourceValue !== runtimeValue) {
    fail(`legacy ${name} differs: source=${sourceValue} runtime=${runtimeValue}`);
  }
}

const sourceWbwClasses = legacySource
  .match(/var WBW_CLASSES\s*=\s*\[([^\]]+)\]/)?.[1]
  ?.match(/'([^']+)'/g)
  ?.map((value) => value.slice(1, -1));
if (JSON.stringify(sourceWbwClasses) !== JSON.stringify(LEGACY_WBW_CLASSES)) {
  fail('legacy word-by-word class catalog differs from the authored source');
}

const legacyCards = [];
const legacyCardPattern = /<div class="card\s+([a-d][1-5])"/gi;
let legacyCardMatch;
while ((legacyCardMatch = legacyCardPattern.exec(legacySource))) {
  const cardMarkup = extractCompleteTemplateDiv(legacySource, legacyCardMatch.index);
  if (!cardMarkup) fail(`${legacyCardMatch[1]} source card could not be extracted`);
  legacyCards.push({
    id: legacyCardMatch[1].toUpperCase(),
    markup: cardMarkup,
    phaseCount: (cardMarkup.match(/class="[^"]*\bsb\b/g) || []).length,
    wordMotions: Array.from(cardMarkup.matchAll(/class="wbw\s+([^"]+)"/g), (match) => match[1]),
    positionedMotions: Array.from(cardMarkup.matchAll(/data-anim="([^"]+)"/g), (match) => match[1]),
  });
  legacyCardPattern.lastIndex = legacyCardMatch.index + cardMarkup.length;
}

if (legacyCards.length !== 20) fail(`left template catalog has ${legacyCards.length} cards instead of 20`);
if (new Set(legacyCards.map((card) => card.id)).size !== 20) {
  fail('left template catalog contains duplicate IDs');
}
if (new Set(legacyCards.map((card) => card.markup)).size !== 20) {
  fail('left template catalog contains duplicate source markup');
}
for (const card of legacyCards) {
  if (card.phaseCount < 4) fail(`${card.id} has only ${card.phaseCount} authored phases`);
  if (!card.wordMotions.length && !card.positionedMotions.length) {
    fail(`${card.id} has no authored motion metadata`);
  }
}
if (!sidebarGallerySource.includes('data-template-card-id={template.id}')) {
  fail('left template cards do not expose stable selection IDs');
}
if (!videoPlayerSource.includes('getAppliedTemplateMarkupSignature(rawMarkup)')) {
  fail('left template cache does not include the selected source markup signature');
}

const appliedSidebarRendererSource = videoPlayerSource.slice(
  videoPlayerSource.indexOf('function AppliedSidebarTemplateSourceRenderer'),
  videoPlayerSource.indexOf('function SidebarSourceTemplateStyles'),
);
if (!appliedSidebarRendererSource.includes('enterBlock(selectedBlock)')) {
  fail('left live rendering does not start the authored preview phase');
}
if (!appliedSidebarRendererSource.includes('host.dataset.appliedAnimationRun')) {
  fail('left live rendering does not expose per-caption animation runs');
}
if (appliedSidebarRendererSource.includes('videoRef?.current?.currentTime')) {
  fail('left live rendering still depends on the media clock for entrance motion');
}

const advancedRendererSource = videoPlayerSource.slice(
  videoPlayerSource.indexOf('function AppliedAdvancedTemplateCaption'),
  videoPlayerSource.indexOf('// --- Effect CSS helper ---'),
);
if (!advancedRendererSource.includes('window.performance.now() - startedAt')) {
  fail('right live rendering does not have a local animation clock');
}
if (!advancedRendererSource.includes('block.dataset.templateAnimationRun')) {
  fail('right live rendering does not expose per-caption animation runs');
}
if (advancedRendererSource.includes('videoRef?.current?.currentTime')) {
  fail('right live rendering still depends on the media clock for entrance motion');
}

for (const [className, animationName] of Object.entries(LEGACY_IMP_ANIMS)) {
  const mappingPattern = new RegExp(
    `'${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:\\s*'${animationName}'`,
  );
  if (!mappingPattern.test(legacySource)) {
    fail(`legacy emphasis mapping ${className} -> ${animationName} is missing`);
  }
}

console.log(
  `Template motion parity passed for ${Object.keys(sourceBlockTypes).length} advanced templates, ${legacyCards.length} unique left templates, and ${LEGACY_WBW_CLASSES.length} legacy motion classes.`,
);
