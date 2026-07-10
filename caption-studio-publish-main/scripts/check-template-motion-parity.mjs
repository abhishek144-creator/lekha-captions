import fs from 'fs/promises';
import {
  ADVANCED_TEMPLATE_RUNTIME_CSS,
  getLcMotionSchedule,
  LEGACY_IMP_ANIMS,
  LEGACY_TEMPLATE_TIMING,
  LEGACY_WBW_CLASSES,
  ORIGINAL_TEMPLATE_BLOCKS,
  ORIGINAL_TEMPLATE_BLOCK_TYPES,
  RECREATED_ADVANCED_TEMPLATE_IDS,
} from '../src/components/dashboard/templateMotionConfig.js';
import {
  buildAdvancedTemplateBlockMarkupMap,
  extractCompleteTemplateDiv,
} from '../src/components/dashboard/advancedTemplateSourceUtils.js';
import {
  getTemplatePhaseTypes,
} from '../src/components/dashboard/emotionalTemplateUtils.js';

const projectRoot = new URL('../', import.meta.url);
const advancedSource = await fs.readFile(
  new URL('src/assets/lekha-captions-T11-T35.html', projectRoot),
  'utf8',
);
const legacySource = await fs.readFile(
  new URL('src/assets/lekha-captions-20-templates.html', projectRoot),
  'utf8',
);
const newTemplateSource = await fs.readFile(
  new URL('src/assets/lekha-captions-49-templates.html', projectRoot),
  'utf8',
);
const videoPlayerSource = await fs.readFile(
  new URL('src/components/dashboard/VideoPlayer.jsx', projectRoot),
  'utf8',
);
const basicTemplateInlineSource = await fs.readFile(
  new URL('src/components/dashboard/basicTemplateInline.js', projectRoot),
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
const exportPanelSource = await fs.readFile(
  new URL('src/components/dashboard/ExportPanel.jsx', projectRoot),
  'utf8',
);
const emotionalTemplateUtilsSource = await fs.readFile(
  new URL('src/components/dashboard/emotionalTemplateUtils.js', projectRoot),
  'utf8',
);
const templatesTabSource = await fs.readFile(
  new URL('src/components/dashboard/TemplatesTab.jsx', projectRoot),
  'utf8',
);
const captionTemplatesCss = await fs.readFile(
  new URL('src/styles/captionTemplates.css', projectRoot),
  'utf8',
);

const lcSchedule = getLcMotionSchedule([
  { animation: 'rise', duration: '430', delay: '280', ease: 'ease-out' },
  { animation: 'pop', duration: '560', delay: '560ms', ease: 'linear' },
]);
if (
  lcSchedule.entries[0]?.delayMs !== 280
  || lcSchedule.entries[0]?.durationMs !== 430
  || lcSchedule.entries[1]?.delayMs !== 560
  || lcSchedule.entries[1]?.durationMs !== 560
  || lcSchedule.endMs !== 1120
) {
  fail(`LC authored schedule was altered: ${JSON.stringify(lcSchedule)}`);
}
if (videoPlayerSource.includes('getLcRevealPlan') || exportRendererSource.includes('getLcRevealPlan')) {
  fail('LC rendering still derives a caption-length-dependent reveal plan');
}
if (!videoPlayerSource.includes('getLcMotionSchedule') || !videoPlayerSource.includes('block.getBoundingClientRect()')) {
  fail('canvas LC renderer does not stamp the shared authored schedule from a committed layout state');
}
if (!sidebarGallerySource.includes('stampLcMotion') || !sidebarGallerySource.includes('getLcMotionSchedule')) {
  fail('template preview does not use the shared authored LC schedule');
}
if (!exportRendererSource.includes('getLcMotionSchedule')) {
  fail('export renderer does not use the shared authored LC schedule');
}

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
  if (
    !RECREATED_ADVANCED_TEMPLATE_IDS.includes(templateId)
    && JSON.stringify(sourceTypes) !== JSON.stringify(runtimeTypes)
  ) {
    fail(
      `${templateId} differs: source=${sourceTypes.join(',')} runtime=${runtimeTypes.join(',')}`,
    );
  }
}

if (!gallerySource.includes('Object.entries(ORIGINAL_TEMPLATE_BLOCKS).map(([templateId, blocks]) => [')) {
  fail('advanced fallback template blocks are not derived from the canonical runtime catalog');
}
if (!gallerySource.includes('type: block.type')) {
  fail('advanced fallback template block types do not preserve the canonical runtime catalog');
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
if (!exportRendererSource.includes('.template-caption-shell')
  || !exportRendererSource.includes('.lekha-sidebar-export-template-shell')
  || !exportRendererSource.includes('.lekha-applied-basic-template-host')) {
  fail('export animation seeking does not resolve advanced, sidebar, and basic template shell types');
}
if (!exportRendererSource.includes('firstTemplateCaption')) {
  fail('export rendering cannot recover canonical template identity from captions');
}
if (exportRendererSource.includes(
  "phase.block.style.transform = 'scale(' + Number(window.__exportCanvasScale || 1) + ')'",
)) {
  fail('left-template export phases double-scale the already scaled export shell');
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
if (exportRendererSource.includes('segment.start + (segment.duration / 2)')) {
  fail('export samples animated template frames at an uncapped segment midpoint');
}
if (!exportRendererSource.includes('const sampleOffset = Math.min(')
  || !exportRendererSource.includes('segment.start + sampleOffset')) {
  fail('export does not sample animated template frames from a capped in-segment offset');
}
if (!exportRendererSource.includes('caption.preview_template_line_texts')
  || !exportRendererSource.includes('applyPreviewTemplateLineBreaks(anchor,')) {
  fail('export does not preserve caption-specific advanced canvas line grouping');
}
if (videoPlayerSource.includes("container.closest?.('.t16-stage, .t16-block')")
  || exportRendererSource.includes("container.closest?.('.t16-stage, .t16-block')")
  || exportRendererSource.includes('splitWordsIntoIndexedLines(words, 2)')) {
  fail('Motivation Stack source-block rendering must use width-based wrapping, not forced balanced lines');
}
const t16ExportWordColorStart = exportRendererSource.indexOf('.lekha-original-template.t16-stage .wbw-rise .w,');
const t16ExportWordColorBlock = t16ExportWordColorStart >= 0
  ? exportRendererSource.slice(t16ExportWordColorStart, t16ExportWordColorStart + 380)
  : '';
if (!t16ExportWordColorBlock || t16ExportWordColorBlock.includes('opacity: 1 !important')) {
  fail('Motivation Stack export word opacity is forced, which breaks WBW animation playback');
}
if (!exportRendererSource.includes('html, body {')) {
  fail('export root does not define shared html/body sizing');
}
if (!exportRendererSource.includes('font-size: ${exportRootFontSize}px;')) {
  fail('export root rem sizing is not tied to the preview/video scale');
}
if (exportRendererSource.includes('Number(window.__exportTemplateFontTargetPx || 0)')) {
  fail('export applies a global measured-font target instead of template-family preview scale');
}
if (exportRendererSource.includes('targetBoxWidthPx / safeScale')) {
  fail('export applies measured-box scaling that can shrink individual template phases');
}
if (exportRendererSource.includes('wrapper.style.transform = `scale(${scale})`')) {
  fail('export applies wrapper transforms that drift from canvas preview font size');
}
for (const staleInlineColor of [
  'rgba(0,229,255,0.6)',
  'rgba(255,61,113,0.8)',
  'rgba(255,255,255,0.4)',
]) {
  if (exportRendererSource.includes(staleInlineColor)) {
    fail(`advanced export contains stale inline fallback colour ${staleInlineColor}`);
  }
}
if (!exportPanelSource.includes("findLargestRenderedElement('.lekha-applied-advanced-template.active'")) {
  fail('export request capture does not prefer the active advanced canvas template for font measurement');
}
if (!exportRendererSource.includes('.lekha-original-template .lekha-applied-advanced-template {')
  || !exportRendererSource.includes('font-size: ${exportAdvancedTemplateFontPx}px;')) {
  fail('advanced export templates do not share the preview-captured font-size baseline');
}
for (const templateId of ['t13', 't14', 't16', 't18']) {
  if (!exportRendererSource.includes(`.lekha-original-template.${templateId}-stage`)) {
    fail(`${templateId} export has no template-specific parity override`);
  }
  if (!videoPlayerSource.includes(`.lekha-original-template.${templateId}-stage`)) {
    fail(`${templateId} canvas preview has no template-specific parity override`);
  }
}
if (!videoPlayerSource.includes("return templateId === 't17' && !!block?.querySelector?.('.snap-txt');")
  || !exportRendererSource.includes("templateId === 't17' && !!block?.querySelector?.('.snap-txt')")) {
  fail('Horror/Tension snap phase must suppress generic white emphasis injection');
}
if (!exportPanelSource.includes('resolvedTemplatePhaseIndex')
  || !exportPanelSource.includes('Number.isFinite(storedTemplatePhaseIndex)')
  || !exportRendererSource.includes('resolveAdvancedTemplatePhaseIndex')
  || !exportRendererSource.includes('caption?.template_phase_index')) {
  fail('advanced exports must honor the canvas stored template_phase_index before caption-order fallback');
}
if (!exportPanelSource.includes('.lekha-original-template .lekha-applied-advanced-template.active .split-title')
  || !videoPlayerSource.includes('.lekha-original-template.t18-stage .split-title')
  || !videoPlayerSource.includes("templateId === 't18' && normalizedBlockIndex === 0")) {
  fail('Cinematic Chapter canvas/export parity must preserve split-title line structure');
}
const recreatedAnimatedTemplateIds = ['t11', 't13', 't16', 't18', 't24', 't25', 't26', 't29', 't31', 't33', 't34'];
for (const templateId of recreatedAnimatedTemplateIds) {
  const blocks = ORIGINAL_TEMPLATE_BLOCKS[templateId] || [];
  if (!blocks.length) fail(`${templateId} is missing from the canonical animated template catalog`);
  blocks.forEach((block, blockIndex) => {
    if (block.type === 'plain') {
      fail(`${templateId} phase ${blockIndex} is static/plain after animation recreation`);
    }
  });
}
if (!videoPlayerSource.includes('RECREATED_ADVANCED_WBW_PHASES')
  || !exportRendererSource.includes('RECREATED_ADVANCED_WBW_PHASES')) {
  fail('recreated advanced WBW phases must be rebuilt in both preview and export renderers');
}
if (!RECREATED_ADVANCED_TEMPLATE_IDS.includes('t34')) {
  fail('Anime Energy must stay in the recreated-template rebuild set');
}
if (!videoPlayerSource.includes('isRecreatedAdvancedTemplateId(templateId)')) {
  fail('recreated advanced preview templates must bypass authored source markup');
}
if (!exportRendererSource.includes('recreatedAdvancedTemplateIds.has(String(templateId || \'\').trim())')) {
  fail('recreated advanced export templates must bypass authored source markup');
}
if (!exportRendererSource.includes("const positionedWords = isAdvancedTemplate ? '' : words")) {
  fail('advanced template exports must not append detached word-layout overlays over recreated template text');
}
if (!exportRendererSource.includes("|| renderedTemplateId === 't29'")) {
  fail('Battle Cry export must replay captured canvas line breaks while other recreated templates keep their own structure');
}
if (videoPlayerSource.includes("templateId === 't14'")
  || exportRendererSource.includes("templateId === 't14'")) {
  fail('Literary Weight styled phases must honor the caption-selected emphasis word');
}
if (videoPlayerSource.includes('font-size\\s*:\\s*0(?:px|rem|em|%)?\\b')
  || exportRendererSource.includes('font-size\\\\s*:\\\\s*0(?:px|rem|em|%)?\\\\b')
  || !videoPlayerSource.includes('font-size\\s*:\\s*0(?:\\.0+)?')
  || !exportRendererSource.includes('font-size\\\\s*:\\\\s*0(?:\\\\.0+)?')) {
  fail('hidden text detection must not treat decimal font sizes like 0.9rem as zero');
}
if (!exportRendererSource.includes('.lekha-original-template.t14-stage .t14-b2')
  || !exportRendererSource.includes('font-size: ${exportAdvancedTemplateFontPx}px !important;')) {
  fail('Literary Weight export phases do not share the preview-captured font size');
}
if (emotionalTemplateUtilsSource.includes('à¤')
  || /'\?{2,}'/.test(emotionalTemplateUtilsSource)
  || !emotionalTemplateUtilsSource.includes("'आज'")
  || !emotionalTemplateUtilsSource.includes("'क्या'")) {
  fail('semantic emphasis stop words are missing valid Hindi entries');
}
if (!videoPlayerSource.includes('.lekha-original-template.t38-stage .imp-underline::after')) {
  fail('Literary Echo canvas preview does not preserve the authored underline phase');
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

const basicCards = [];
const basicCardPattern = /<div class="btcard[^"]*"/gi;
let basicCardMatch;
while ((basicCardMatch = basicCardPattern.exec(advancedSource))) {
  const cardMarkup = extractCompleteTemplateDiv(advancedSource, basicCardMatch.index);
  if (!cardMarkup) fail('right basic template source card could not be extracted');
  const name = cardMarkup.match(/<div class="btcard-name">([\s\S]*?)<\/div>/i)?.[1]
    ?.replace(/<[^>]+>/g, '')
    ?.trim() || 'unknown';
  const phaseCount = (cardMarkup.match(/class="[^"]*\bbt-cap-block\b/g) || []).length;
  basicCards.push({
    name,
    phaseCount,
    runtimePhaseTypes: getTemplatePhaseTypes(cardMarkup),
  });
  basicCardPattern.lastIndex = basicCardMatch.index + cardMarkup.length;
}

if (basicCards.length !== 20) fail(`right basic template catalog has ${basicCards.length} cards instead of 20`);
for (const card of basicCards) {
  if (card.phaseCount < 1) fail(`right basic template ${card.name} has no authored phases`);
  if (card.runtimePhaseTypes.length !== card.phaseCount) {
    fail(
      `right basic template ${card.name} differs: source=${card.phaseCount} runtime=${card.runtimePhaseTypes.length}`,
    );
  }
}
const sanitizedNewTemplateSource = newTemplateSource
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/\s+bis_skin_checked="[^"]*"/gi, '');
const newTemplateCards = [];
const newTemplateCardPattern = /<div class="lk-card\s+([^"]+)"/gi;
let newTemplateCardMatch;
while ((newTemplateCardMatch = newTemplateCardPattern.exec(sanitizedNewTemplateSource))) {
  const cardMarkup = extractCompleteTemplateDiv(sanitizedNewTemplateSource, newTemplateCardMatch.index);
  if (!cardMarkup) fail(`49-template card ${newTemplateCardMatch[1]} could not be extracted`);
  newTemplateCards.push({
    className: newTemplateCardMatch[1],
    phaseCount: (cardMarkup.match(/class="[^"]*\bsblock\b/g) || []).length,
    hasMotionMarkup: /\b(?:wbw-line|sw-line|sw|plain-s|pos\d+)/.test(cardMarkup),
  });
  newTemplateCardPattern.lastIndex = newTemplateCardMatch.index + cardMarkup.length;
}
if (newTemplateCards.length !== 49) {
  fail(`49-template catalog has ${newTemplateCards.length} cards instead of 49`);
}
for (const card of newTemplateCards) {
  if (card.phaseCount < 1) fail(`49-template ${card.className} has no authored phases`);
  if (!card.hasMotionMarkup) fail(`49-template ${card.className} has no authored motion/text markup`);
}
// The 49-pack is intentionally hidden from the selectable gallery, but it must
// stay in ALL_TEMPLATE_CARDS so older saved projects that reference it still
// resolve their preview/export styles. LC templates are the selectable set.
if (!sidebarGallerySource.includes('const TEMPLATE_CARDS = [...LEGACY_TEMPLATE_CARDS]')) {
  fail('left template gallery legacy catalog changed shape');
}
if (!/const ALL_TEMPLATE_CARDS = \[[\s\S]*?\.\.\.NEW_TEMPLATE_CARDS,[\s\S]*?\.\.\.LC_TEMPLATE_CARDS,[\s\S]*?\];/.test(sidebarGallerySource)) {
  fail('left template style map no longer resolves the hidden 49-pack and LC templates');
}
if (!sidebarGallerySource.includes("{ id: 'lc-style-1', title: 'LC Style 1', templates: LC_STYLE_1_TEMPLATE_CARDS }")) {
  fail('left template gallery does not render the LC template sections');
}
if (!sidebarGallerySource.includes("const getTemplateStyleKey = (template) => `${template?.format || 'legacy'}::${template?.id || ''}`")) {
  fail('left template extracted-style cache is not keyed by template source and ID');
}
if (!sidebarGallerySource.includes('EXTRACTED_TEMPLATE_STYLE_MAP[getTemplateStyleKey(template)]')) {
  fail('left template application does not read extracted style by source-aware key');
}
if (!sidebarGallerySource.includes("cyan: BRIGHT_CYAN")) {
  fail('left template accent extraction does not preserve cyan accents');
}
if (!sidebarGallerySource.includes("if (family.startsWith('ns') && colorName === 'rose') return '#FF6B1A';")) {
  fail('left template accent extraction does not preserve 49-pack orange/rose accents');
}
for (const className of LEGACY_WBW_CLASSES) {
  if (!videoPlayerSource.includes(`.lekha-sidebar-source-template .wbw.${className}`)) {
    fail(`left canvas preview is missing WBW class ${className}`);
  }
  if (!exportRendererSource.includes(`classes.contains('${className}')`)) {
    fail(`left export motion mapper is missing WBW class ${className}`);
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

if (!basicTemplateInlineSource.includes('revealWholeBlock || index <= currentIndex')) {
  fail('right basic templates do not reveal the active block as a whole');
}
if (!videoPlayerSource.includes('data-export-measure="basic-template"')
  || !videoPlayerSource.includes('data-export-measure="sidebar-template"')
  || !videoPlayerSource.includes('data-export-measure="advanced-template"')) {
  fail('canvas template renderers do not expose explicit export measurement markers');
}
if (!exportPanelSource.includes("findLargestRenderedElement('[data-caption-layer=\"true\"] [data-export-measure]'")) {
  fail('export request capture does not prefer the active canvas template measurement marker');
}
if (!exportRendererSource.includes('--applied-basic-scale:')
  || !basicTemplateInlineSource.includes('var(--applied-basic-scale, 1)')) {
  fail('right basic template box geometry does not scale with the export canvas scale');
}
const appliedBasicCssStart = captionTemplatesCss.indexOf('Applied Basic templates mirror the right-panel preview');
const appliedBasicCss = appliedBasicCssStart >= 0 ? captionTemplatesCss.slice(appliedBasicCssStart) : '';
if (!appliedBasicCss) {
  fail('right basic template applied-motion override is missing');
}
for (const requiredBasicLayoutRule of [
  'flex-wrap: nowrap !important',
  'white-space: nowrap !important',
  'gap: 0.34em !important',
  'gap: 0.18em !important',
]) {
  if (!basicTemplateInlineSource.includes(requiredBasicLayoutRule)) {
    fail(`right basic template applied line layout is missing ${requiredBasicLayoutRule}`);
  }
}
for (const staleAppliedAnimation of [
  'basicCurrentPop',
  'basicPulseGlow',
  'basicSpeedKick',
  'basicQuietWave',
]) {
  if (new RegExp(`animation\\s*:[^;]*${staleAppliedAnimation}`).test(appliedBasicCss)) {
    fail(`right basic current-word highlight still uses ${staleAppliedAnimation}`);
  }
}
if (/\.word\.current[\s\S]{0,160}basicWordRiseIn/.test(appliedBasicCss)) {
  fail('right basic current-word highlight still uses basicWordRiseIn');
}
if (!appliedBasicCss.includes('lekha-basic-template-enter-once.t-106')
  || !appliedBasicCss.includes('lekha-basic-template-enter-once.t-52')
  || !appliedBasicCss.includes('lekha-basic-template-enter-once.t-WS1')) {
  fail('right basic one-time entrance animations for Iman, Light Streak, or Word Slide are missing');
}
if (!basicTemplateInlineSource.includes('t-106 .bt-cap-block.basic-phase-1 .t-106 .word.current')
  || !basicTemplateInlineSource.includes('t-106 .bt-cap-block.basic-phase-2 .t-106 .word.current')
  || !basicTemplateInlineSource.includes('animation: basicLightStreakSlideRight 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;')
  || !captionTemplatesCss.includes('.lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-106 .bt-cap-block.basic-phase-1 .lekha-basic-template-animated .word.current')
  || !captionTemplatesCss.includes('.lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-106 .bt-cap-block.basic-phase-2 .lekha-basic-template-animated .word.current')
  || !gallerySource.includes("block.querySelectorAll('.t-106').forEach((wrapper) => {")
  || !gallerySource.includes("phaseIndex === 2")
  || !templatesTabSource.includes("const isIman = template.id === 't-106';")
  || !templatesTabSource.includes("isIman && phase === 2")) {
  fail('Iman phase 1 must be plain and phase 2 must slide from the right like Light Streak phase 2');
}
if (!basicTemplateInlineSource.includes('basic-phase-1 .t-52 .word.current')
  || !basicTemplateInlineSource.includes('animation: basicLightStreakSlideLeft 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;')
  || !basicTemplateInlineSource.includes('basic-phase-2 .t-52 .word.current')
  || !basicTemplateInlineSource.includes('animation: basicLightStreakSlideRight 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;')
  || !captionTemplatesCss.includes('.lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .bt-cap-block.basic-phase-1 .lekha-basic-template-animated .word.current')
  || !captionTemplatesCss.includes('.lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-52 .bt-cap-block.basic-phase-2 .lekha-basic-template-animated .word.current')
  || !templatesTabSource.includes("animation: `${phase === 1 ? 'basicWordSlideFromLeft' : 'basicWordSlideFromRight'} 0.42s cubic-bezier(0.22,1,0.36,1) both`")) {
  fail('Light Streak phase 1 must mirror phase 2 as the opposite-direction slide in preview and applied renderers');
}
if (!/t-T4[\s\S]{0,220}basic-phase-1[\s\S]{0,260}wordSlideIn/.test(appliedBasicCss)) {
  fail('Study With Me phase 1 does not use the Word Slide entrance');
}
if (!videoPlayerSource.includes('function resolveAppliedBasicTemplateMarkup')
  || !videoPlayerSource.includes('markupMatchesTemplate')
  || !videoPlayerSource.includes("findAppliedBasicTemplateMarkup({ template_id: templateId })")) {
  fail('Study With Me applied renderer must reject stale Basic markup and reload the matching source template');
}
const studyLineResetStart = appliedBasicCss.indexOf(
  '.lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .bt-cap-block.basic-phase-0 .lekha-basic-template-animated,',
);
const studyLineResetBlock = studyLineResetStart >= 0
  ? appliedBasicCss.slice(studyLineResetStart, studyLineResetStart + 3200)
  : '';
if (!studyLineResetBlock.includes('animation: basicWordSlideFromLeft 0.42s cubic-bezier(0.22, 1, 0.36, 1) both !important;')
  || !appliedBasicCss.includes('.lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .bt-cap-block.basic-phase-2 .lekha-basic-template-animated,')
  || !appliedBasicCss.includes('animation: wordRiseInFromBottom 0.38s cubic-bezier(0.34, 1.2, 0.64, 1) both !important;')
  || !studyLineResetBlock.includes('animation-delay: 0ms !important;')
  || !appliedBasicCss.includes('.lekha-applied-basic-template-host.lekha-basic-template-enter-once.t-T4 .lekha-basic-template-animated.has-manual-lines .basic-manual-line-2 {')) {
  fail('Study With Me phase 0/2 must animate the whole line wrapper');
}
if (!basicTemplateInlineSource.includes("wrapper.classList.add(`study-line-${index}`);")
  || !basicTemplateInlineSource.includes("if (index === 1) wrapper.classList.add('study-word-slide-preview');")) {
  fail('Study With Me applied renderer is missing its phase-specific line classes');
}
if (!captionTemplatesCss.includes('.t-T4.study-line-0 .cap-text:not(.has-manual-lines),')
  || !captionTemplatesCss.includes('.t-T4.study-line-2 .cap-text:not(.has-manual-lines),')
  || !captionTemplatesCss.includes('.t-T4.study-line-0 .word,')
  || !captionTemplatesCss.includes('.t-T4.study-line-2 .word,')
  || !captionTemplatesCss.includes('.t-T4.study-word-slide-preview .word,')) {
  fail('Study With Me preview CSS is missing the line-level phase 0/2 motion split');
}
const studyGalleryBlockStart = gallerySource.indexOf("block.querySelectorAll('.t-T4').forEach((wrapper) => {");
const studyGalleryBlockEnd = studyGalleryBlockStart >= 0
  ? gallerySource.indexOf("block.querySelectorAll('.t-106').forEach((wrapper) => {", studyGalleryBlockStart)
  : -1;
const studyGalleryBlock = studyGalleryBlockStart >= 0 && studyGalleryBlockEnd > studyGalleryBlockStart
  ? gallerySource.slice(studyGalleryBlockStart, studyGalleryBlockEnd)
  : '';
if (!studyGalleryBlock.includes("wrapper.classList.remove('study-line-0', 'study-line-1', 'study-line-2', 'study-word-slide-preview');")
  || !studyGalleryBlock.includes("word.style.setProperty('--ws-delay', (90 + (wordIndex * 55)) + 'ms');")
  || !studyGalleryBlock.includes("wrapper.classList.toggle('study-word-slide-preview', phaseIndex === 1);")
  || studyGalleryBlock.includes('word.style.animation =')) {
  fail('Study With Me template preview should delegate phase 0/2 motion to the whole line');
}
if (!templatesTabSource.includes("...(isLightStreak && phase > 0")
  || !templatesTabSource.includes("...((isWordSlide || (isStudyWithMe && phase === 1))")
  || !templatesTabSource.includes('study-word-slide-preview')
  || !templatesTabSource.includes("animation: 'basicWordSlideFromLeft 0.42s cubic-bezier(0.22,1,0.36,1) both'")
  || !templatesTabSource.includes("animation: 'wordRiseInFromBottom 0.38s cubic-bezier(0.34,1.2,0.64,1) both'")) {
  fail('Study With Me card preview still applies phase 0/2 motion per word');
}
const basicPreviewFrameStart = gallerySource.indexOf('function BasicTemplatePreviewFrame');
const basicPreviewFrameEnd = basicPreviewFrameStart >= 0
  ? gallerySource.indexOf('export default function AdvancedTemplateLibrary', basicPreviewFrameStart)
  : -1;
const basicPreviewFrame = basicPreviewFrameStart >= 0 && basicPreviewFrameEnd > basicPreviewFrameStart
  ? gallerySource.slice(basicPreviewFrameStart, basicPreviewFrameEnd)
  : '';
if (!basicPreviewFrame.includes('onSelect')
  || !basicPreviewFrame.includes('onSelect?.();')
  || !gallerySource.includes('const applyBasicTemplate = () => onApplyTemplate?.(defaultStyle);')
  || !gallerySource.includes('onSelect={applyBasicTemplate}')) {
  fail('right basic preview dot clicks do not apply the selected template');
}
if (!templatesTabSource.includes("id: 't-WS1', name: 'Motion Slide'")
  || !templatesTabSource.includes("template_class: 'btcard t-WS1'")
  || !templatesTabSource.includes("template_source: 'lekha-basic'")
  || !templatesTabSource.includes('PHASED_PREVIEW_WORDS')
  || !templatesTabSource.includes('study-word-slide-preview')
  || !templatesTabSource.includes('ws-line-${basicPreviewPhase % PHASED_PREVIEW_WORDS.length}')
  || !templatesTabSource.includes('"t-WS1": ["primary", "highlight"]')) {
  fail('Word Slide is not available as an applied Basic template in the Templates tab');
}
if (/key=\{`applied-basic-tpl-[^`]*\$\{currentIdx\}/.test(videoPlayerSource)) {
  fail('right basic applied template remounts the whole line when the current word changes');
}
if (videoPlayerSource.includes("`basic|${templateId}|${getAppliedTemplateMarkupSignature(rawMarkup)}|${activePhase}|${currentIndex}|")) {
  fail('right basic applied template rebuilds injected HTML when the current word changes');
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
  `Template motion parity passed for ${Object.keys(sourceBlockTypes).length} advanced templates, ${basicCards.length} right basic templates, ${legacyCards.length + newTemplateCards.length} left templates, and ${LEGACY_WBW_CLASSES.length} legacy motion classes.`,
);
