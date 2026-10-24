import { buildRuntimeScript, ADVANCED_TEMPLATE_VARIANTS, TEMPLATE_CANVAS_FONT_SCALE, LINE_ANIMATION_DEFS, SIDEBAR_TEMPLATE_WORD_STAGGER_SECONDS, SIDEBAR_TEMPLATE_POSITION_STAGGER_SECONDS } from './render_template_page_runtime.mjs'
import fs from 'fs/promises';
import path from 'path';
import { isAdvancedTemplateId, extractHtmlStyle } from '../src/components/dashboard/templateTextRules.js';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { browserLaunchOptions, connectWarmBrowser } from './render_browser_runtime.mjs';
import {
  ADVANCED_IMP_ENTRANCES,
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  ADVANCED_TEMPLATE_RUNTIME_CSS,
  ADVANCED_TEMPLATE_TIMING,
  LEGACY_TEMPLATE_TIMING,
  ORIGINAL_TEMPLATE_BLOCK_TYPES,
  RECREATED_ADVANCED_TEMPLATE_IDS,
  LC_TEMPLATE_TIMING,
  fitLcMotionScheduleToCaption,
  getAdvancedAnimationWindowMs,
  getLcMotionSchedule,
  getOriginalTemplateBlockType,
  getKeyframeTemplatePlaybackMs,
  isKeyframeAdvancedTemplateId,
  KEYFRAME_ADVANCED_TEMPLATE_IDS,
  seekKeyframeTemplateAnimations,
} from '../src/components/dashboard/templateMotionConfig.js';
import {
  buildAdvancedTemplateBlockMarkupMap,
} from '../src/components/dashboard/advancedTemplateSourceUtils.js';
import {
  buildEmotionalCaptionPlan,
} from '../src/components/dashboard/emotionalTemplateUtils.js';
import {
  SOURCE_BASIC_TEMPLATE_IDS,
  isSourceBasicTemplateId,
  findAppliedBasicTemplateMarkup,
  APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES,
  APPLIED_BASIC_TEMPLATE_FONT_SCALE,
  normalizeAppliedBasicTemplateFontSize,
} from '../src/components/dashboard/basicTemplateInline.js';
import {
  detectScript,
  resolveScriptFontFamily,
} from '../src/components/dashboard/scriptFontResolver.js';
import {
  getCaptionWordRevealTimes,
  getCaptionWordStartTime,
} from '../src/components/dashboard/cptMotion.js';
import { googleFontFamilyParam } from './render_font_axes.mjs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const PACKAGED_RENDER_FONT_FAMILIES = new Set([
  'Baloo 2', 'Baloo Bhai 2', 'Baloo Da 2', 'Baloo Tamma 2', 'Catamaran',
  'Inter', 'Kalam', 'Mandali', 'Manjari', 'Marcellus', 'Montserrat',
  // Mukta, Poppins and Rajdhani come from the render font bundle with every
  // weight (build_render_font_bundle.mjs); the installed files are one weight.
  'Mukta Mahee', 'Mukta Malar', 'Noto Sans', 'Noto Sans Bengali',
  'Noto Sans Devanagari', 'Noto Sans Kannada', 'Noto Sans Malayalam',
  'Noto Sans Telugu', 'Roboto',
].map((family) => family.toLowerCase()));
let bundledRenderFontCss = '';
let bundledRenderFontFamilies = new Set();

function needsRemoteRenderFont(fontFamily) {
  if (process.env.PREFER_PACKAGED_RENDER_FONTS !== '1') return true;
  const normalized = String(fontFamily || '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
    .toLowerCase();
  return normalized
    ? !PACKAGED_RENDER_FONT_FAMILIES.has(normalized) && !bundledRenderFontFamilies.has(normalized)
    : false;
}



// Match the authored 20-template preview engine exactly.



function toForwardSlash(inputPath) {
  return inputPath.replace(/\\/g, '/');
}

// Frame segmentation runs outside the page runtime, so keep a small Node-side
// twin for detecting captions whose displaced words reveal during playback.
function captionHasCptWordStyles(caption) {
  return Object.values(caption?.word_styles || {}).some((wordStyle = {}) => (
    Math.abs(Number(wordStyle?.abs_x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.abs_y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.x_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.y_pct) || 0) > 0.01
    || Math.abs(Number(wordStyle?.x) || 0) > 0.01
    || Math.abs(Number(wordStyle?.y) || 0) > 0.01
  ));
}


function scaleTemplateFontSize(fontSize) {
  return Math.max(12, Math.round((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
}

function estimateAdvancedPreviewTemplateBox(payload, previewWidth = 0) {
  if (!isAdvancedTemplateId(payload?.style?.template_id)) {
    return { width: 0, height: 0 };
  }

  const fontSize = Math.max(16, Number(payload?.style?.font_size || 23));
  const lineSpacing = Math.max(1, Number(payload?.style?.line_spacing || 1.25));
  const maxPreviewWidth = Math.max(180, Number(previewWidth || 0) || 314);
  const firstCaption = (payload?.captions || []).find((caption) => caption && !caption.is_text_element);
  const words = String(firstCaption?.text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lineCount = words.length >= 3 ? 2 : 1;
  const midpoint = Math.ceil(words.length / lineCount);
  const lines = lineCount === 1
    ? [words.join(' ')]
    : [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')];
  const maxLineLength = Math.max(
    6,
    ...lines.map((line) => Array.from(line || '').length),
  );

  return {
    width: Math.min(maxPreviewWidth * 0.82, Math.max(fontSize * 4.8, maxLineLength * fontSize * 0.72)),
    height: Math.max(fontSize * lineSpacing, fontSize * lineSpacing * lineCount),
  };
}

function getTemplateBlockType(templateId, blockIndex = 0) {
  return getOriginalTemplateBlockType(templateId, blockIndex);
}

function getAdvancedTemplateAnimationWindow(blockType, captionDuration, wordCount = 1, templateId = '') {
  const duration = Math.max(Number(captionDuration) || 0, 0);
  return Math.min(duration, getAdvancedAnimationWindowMs(blockType, wordCount, templateId) / 1000);
}

function extractOriginalTemplateRuntimeCss(originalTemplateHtml) {
  const style = originalTemplateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
  const startToken = '/* ===== SENTENCE BLOCKS ===== */';
  const start = style.indexOf(startToken);
  return start >= 0 ? style.slice(start) : style;
}




async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    throw new Error('Missing payload JSON path');
  }

  const payload = JSON.parse((await fs.readFile(payloadPath, 'utf8')).replace(/^\uFEFF/, ''));
  const renderFontBundlePath = String(process.env.RENDER_FONT_BUNDLE_PATH || '').trim();
  if (renderFontBundlePath) {
    try {
      const [css, manifestRaw] = await Promise.all([
        fs.readFile(renderFontBundlePath, 'utf8'),
        fs.readFile(`${renderFontBundlePath}.json`, 'utf8'),
      ]);
      const manifest = JSON.parse(manifestRaw);
      if (!css.includes('@font-face') || !Array.isArray(manifest.families)) {
        throw new Error('invalid bundled font manifest');
      }
      const digest = (await import('crypto')).createHash('sha256').update(css).digest('hex');
      if (digest !== manifest.sha256) throw new Error('bundled font digest mismatch');
      bundledRenderFontCss = css;
      bundledRenderFontFamilies = new Set(manifest.families.map((family) => String(family).toLowerCase()));
    } catch (error) {
      if (process.env.RENDER_FONT_BUNDLE_REQUIRED === '1') throw error;
      console.warn(`[Template DOM] bundled fonts unavailable: ${error.message}`);
    }
  } else if (process.env.RENDER_FONT_BUNDLE_REQUIRED === '1') {
    throw new Error('RENDER_FONT_BUNDLE_PATH is required');
  }
  payload.__geometry_audit = process.env.TEMPLATE_OVERLAY_GEOMETRY_AUDIT === '1';
  // The editor's planner reads camelCase layoutSource; the export request
  // carries it as layout_source.
  (payload.captions || []).forEach((caption) => {
    if (caption && caption.layout_source && !caption.layoutSource) caption.layoutSource = caption.layout_source;
  });
  const canonicalEmphasisByCaptionId = new Map(
    buildEmotionalCaptionPlan(
      payload.captions || [],
      payload.waveform_data || [],
      payload.duration || 0,
      payload.style?.template_markup || payload.style?.template_snapshot?.template_markup || '',
    ).map((entry) => [String(entry.captionId), entry]),
  );
  (payload.captions || []).forEach((caption) => {
    if (caption) caption.__export_script = detectScript(caption.text || '');
    if (!caption || caption.is_text_element) return;
    const isAuthoredCpt = Object.values(caption.word_styles || {}).some((wordStyle) => (
      wordStyle
      && (
        (Number.isFinite(Number(wordStyle.cptCanvasXPercent))
          && Number.isFinite(Number(wordStyle.cptCanvasYPercent)))
        || (Number.isFinite(Number(wordStyle.abs_x_pct))
          && Number.isFinite(Number(wordStyle.abs_y_pct)))
        || (Number.isFinite(Number(wordStyle.x_pct))
          && Number.isFinite(Number(wordStyle.y_pct)))
      )
    ));
    // A CPT's authored emphasis is part of the saved canvas composition. The
    // emotional-caption planner is appropriate for untouched templates, but
    // must not replace the user's CPT word selection during export.
    if (isAuthoredCpt) return;
    const canonical = canonicalEmphasisByCaptionId.get(String(caption.id));
    if (!canonical) return;
    const appliedStyle = caption.applied_template_style || payload.style || {};
    const templateEmphasisColor = appliedStyle.highlight_color
      || appliedStyle.emphasis_color
      || appliedStyle.secondary_color
      || payload.style?.highlight_color
      || payload.style?.emphasis_color
      || payload.style?.secondary_color
      || canonical.emphasisColor
      || '';
    caption.emphasis_color = templateEmphasisColor;
    // The editor sends the keywords it shows, planned with the audio loudness
    // (waveform) the export never receives. Re-planning here without it picked
    // different keywords than the canvas (e.g. "usually" instead of "boring"),
    // so the editor's choice wins; the planner only fills captions sent without.
    const sentIndices = (Array.isArray(caption.imp_word_indices) ? caption.imp_word_indices : [])
      .map(Number)
      .filter((index) => Number.isInteger(index) && index >= 0);
    const sentIndex = Number(caption.imp_word_index);
    if (sentIndices.length || (Number.isInteger(sentIndex) && sentIndex >= 0)) {
      caption.imp_word_indices = sentIndices.length ? sentIndices : [sentIndex];
      caption.imp_word_index = Number.isInteger(sentIndex) && sentIndex >= 0 ? sentIndex : sentIndices[0];
      return;
    }
    caption.imp_word_index = canonical.impWordIndex;
    caption.imp_word_indices = canonical.impWordIndices || (
      Number.isFinite(Number(canonical.impWordIndex)) && Number(canonical.impWordIndex) >= 0
        ? [Number(canonical.impWordIndex)]
        : []
    );
    caption.imp_word_chosen = !!canonical.emphasisChosen;
  });
  const firstTemplateCaption = (payload.captions || []).find((caption) => (
    !caption?.is_text_element
    && (
      caption?.template_id
      || caption?.template_20_id
      || caption?.applied_template_style?.template_id
      || caption?.applied_template_style?.template_20_id
    )
  ));
  const captionTemplateStyle = firstTemplateCaption
    ? {
        ...(firstTemplateCaption.applied_template_style || {}),
        template_id: firstTemplateCaption.template_id
          || firstTemplateCaption.applied_template_style?.template_id
          || '',
        template_20_id: firstTemplateCaption.template_20_id
          || firstTemplateCaption.applied_template_style?.template_20_id
          || '',
        template_source: firstTemplateCaption.template_source
          || firstTemplateCaption.applied_template_style?.template_source
          || '',
        template_name: firstTemplateCaption.template_name
          || firstTemplateCaption.applied_template_style?.template_name
          || '',
        template_class: firstTemplateCaption.template_class
          || firstTemplateCaption.applied_template_style?.template_class
          || '',
        template_layout: firstTemplateCaption.template_layout
          || firstTemplateCaption.applied_template_style?.template_layout
          || '',
        template_effect: firstTemplateCaption.template_effect
          || firstTemplateCaption.applied_template_style?.template_effect
          || '',
        template_markup: firstTemplateCaption.template_markup
          || firstTemplateCaption.applied_template_style?.template_markup
          || '',
      }
    : {};
  const payloadStyle = payload.style || {};
  const styleSnapshot = payloadStyle.template_snapshot || {};
  const captionTemplateId = String(
    captionTemplateStyle.template_id || captionTemplateStyle.template_20_id || '',
  ).trim();
  const payloadTemplateId = String(
    payloadStyle.template_id || payloadStyle.template_20_id || '',
  ).trim();
  const globalStyleMatchesCaption = !captionTemplateId
    || !payloadTemplateId
    || captionTemplateId === payloadTemplateId;
  const resolvedStyle = globalStyleMatchesCaption
    ? { ...captionTemplateStyle, ...styleSnapshot, ...payloadStyle }
    : { ...payloadStyle, ...styleSnapshot, ...captionTemplateStyle };
  [
    'template_id',
    'template_20_id',
    'template_source',
    'template_name',
    'template_class',
    'template_layout',
    'template_effect',
    'template_markup',
  ].forEach((key) => {
    resolvedStyle[key] = resolvedStyle[key] || '';
  });
  payload.style = resolvedStyle;
  const outputDir = payload.output_dir || path.join(projectRoot, 'tmp-overlay');
  await fs.mkdir(outputDir, { recursive: true });
  const shouldAuditWordPositions = process.env.TEMPLATE_OVERLAY_POSITION_AUDIT === '1';

  const captionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplates.css'), 'utf8');
  const advancedCaptionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplatesAdvanced.css'), 'utf8');
  const originalTemplateHtml = await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-T11-T35.html'), 'utf8');
  const originalTemplateCss = extractOriginalTemplateRuntimeCss(originalTemplateHtml);
  const advancedTemplateBlockMarkup = buildAdvancedTemplateBlockMarkupMap(
    originalTemplateHtml,
    ORIGINAL_TEMPLATE_BLOCK_TYPES,
  );

  // Right-side "Basic" templates (Iman, Green Neon Pulse, 3D Shadow, …) render
  // in the preview through their authored `.btcard` source markup. Render the
  // SAME markup here so the burned video matches the canvas. The builder is
  // shared (basicTemplateInline.js) and injected into the page so the per-frame
  // word injection runs through the exact preview code path.
  const basicTemplateIdsInUse = new Set(
    [
      payload.style?.template_id,
      ...(payload.captions || []).flatMap((caption) => [
        caption?.template_id,
        caption?.applied_template_style?.template_id,
      ]),
    ]
      .map((id) => String(id || '').trim())
      .filter((id) => isSourceBasicTemplateId(id)),
  );
  const hasBasicTemplate = basicTemplateIdsInUse.size > 0;
  const basicTemplateMarkupMap = {};
  for (const templateId of basicTemplateIdsInUse) {
    basicTemplateMarkupMap[templateId] = findAppliedBasicTemplateMarkup(
      originalTemplateHtml,
      { template_id: templateId },
    );
  }
  // Caption text rules shared with the editor preview (classic script: drop `export`).
  const templateTextRulesSource = (await fs.readFile(
    path.join(projectRoot, 'src', 'components', 'dashboard', 'templateTextRules.js'),
    'utf8',
  )).replace(/^\s*export\s+/gm, '');
  const basicTemplateInlineSource = hasBasicTemplate
    ? (await fs.readFile(
        path.join(projectRoot, 'src', 'components', 'dashboard', 'basicTemplateInline.js'),
        'utf8',
      ))
        // Convert the ES module to a classic page script: drop the `export`
        // keyword from every declaration. The trailing `window.__basicTpl`
        // assignment then exposes the builder to the per-frame render loop.
        .replace(/^\s*export\s+/gm, '')
    : '';
  const hasSidebarTemplate = Boolean(payload.style?.template_20_id);
  const sidebarTemplateHtml = hasSidebarTemplate
    ? await fs.readFile(path.join(projectRoot, 'src', 'assets', payload.style?.template_source === 'lekha-lc'
      ? 'lekha-captions-lc-2.html'
      : 'lekha-captions-20-templates.html'), 'utf8')
    : '';
  const sidebarTemplateCss = hasSidebarTemplate
    ? payload.style?.template_source === 'lekha-lc'
      ? [
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-2.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-3.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-4.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-5.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-studio.html'), 'utf8'),
          await fs.readFile(path.join(projectRoot, 'src', 'assets', 'lekha-captions-lc-picks.html'), 'utf8'),
        ].map(extractHtmlStyle).join('\n')
      : extractHtmlStyle(sidebarTemplateHtml)
    : '';
  const previewWidth = Number(payload.style?.preview_width || 0);
  const exportCssScale = Math.max(1, Math.min(8, Number(payload.video_width || 360) / (previewWidth || 360)));
  const hasAdvancedTemplate = isAdvancedTemplateId(payload.style?.template_id);
  const fallbackAdvancedPreviewBox = estimateAdvancedPreviewTemplateBox(payload, previewWidth);
  const measuredPreviewTemplateBoxWidthPx = Number(payload.style?.preview_template_box_width_px || 0);
  const measuredPreviewTemplateBoxHeightPx = Number(payload.style?.preview_template_box_height_px || 0);
  const previewTemplateBoxWidthPx = measuredPreviewTemplateBoxWidthPx
    || fallbackAdvancedPreviewBox.width;
  const previewTemplateBoxHeightPx = measuredPreviewTemplateBoxHeightPx
    || fallbackAdvancedPreviewBox.height;
  const measuredPreviewTemplateFontPx = Number(payload.style?.preview_template_font_px || 0);
  const configuredTemplateFontPx = Number(payload.style?.font_size || 0);
  const previewTemplateFontFloorPx = configuredTemplateFontPx > 0
    ? Math.max(12, Math.round(configuredTemplateFontPx * 0.88))
    : 0;
  const previewTemplateFontPx = measuredPreviewTemplateFontPx > 0
    ? measuredPreviewTemplateFontPx
    : previewTemplateFontFloorPx;
  const fallbackTemplateFontPx = hasAdvancedTemplate
    ? Number(payload.style?.font_size || 0)
    : 0;
  const exportTemplateBoxTargetWidthPx = previewTemplateBoxWidthPx > 0
    ? previewTemplateBoxWidthPx * exportCssScale
    : 0;
  const exportTemplateBoxTargetHeightPx = previewTemplateBoxHeightPx > 0
    ? previewTemplateBoxHeightPx * exportCssScale
    : 0;
  const exportTemplateFontTargetPx = (previewTemplateFontPx > 0 ? previewTemplateFontPx : fallbackTemplateFontPx) > 0
    ? (previewTemplateFontPx > 0 ? previewTemplateFontPx : fallbackTemplateFontPx) * exportCssScale
    : 0;
  const exportAdvancedTemplateFontPx = Math.max(
    12,
    Math.round(exportTemplateFontTargetPx || scaleTemplateFontSize(payload.style?.font_size || 22) * exportCssScale),
  );
  const exportRootFontSize = Math.round(16 * exportCssScale);
  const exportTemplateMaxWidth = Math.round(360 * exportCssScale);
  const exportMeasuredAdvancedTemplateWidthPx = hasAdvancedTemplate && measuredPreviewTemplateBoxWidthPx > 0
    ? Math.max(1, Math.round(measuredPreviewTemplateBoxWidthPx * exportCssScale))
    : 0;
  const exportT24TemplateMaxWidthPx = exportMeasuredAdvancedTemplateWidthPx
    || Math.round(Math.min(exportTemplateMaxWidth, 260 * exportCssScale));
  const exportSidebarWidth = Math.round(Math.max(
    160,
    (measuredPreviewTemplateBoxWidthPx || 320) * exportCssScale,
  ));
  const exportSidebarHeight = Math.round(Math.max(
    1,
    (measuredPreviewTemplateBoxHeightPx || (measuredPreviewTemplateBoxWidthPx || 320) * 1.28) * exportCssScale,
  ));
  const sourceTemplateFontFamilies = new Set();
  const fontFamilyPattern = /font-family\s*:\s*([^;}{]+)/gi;
  const templateFontSources = [
    captionCss,
    advancedCaptionCss,
    originalTemplateCss,
    sidebarTemplateCss,
    ...Object.values(basicTemplateMarkupMap),
  ];
  templateFontSources.forEach((source) => {
    let match;
    fontFamilyPattern.lastIndex = 0;
    while ((match = fontFamilyPattern.exec(String(source || '')))) {
      const family = String(match[1] || '')
        .split(',')[0]
        .replace(/(?:&#39;|&quot;|["'])/gi, '')
        .trim();
      if (
        family
        && !/^(?:inherit|initial|unset|var\(|sans-serif|serif|monospace|cursive)/i.test(family)
      ) {
        sourceTemplateFontFamilies.add(family);
      }
    }
  });
  // The canvas resolves the selected caption family itself (for example,
  // Poppins stays Poppins for Devanagari). Those inline/configured families do
  // not necessarily appear in the template CSS above. If they are omitted from
  // this map, applySourceTemplateScriptFonts() falls through to the generic
  // script fallback and export gets different glyph metrics — word centres stay
  // correct but the narrower glyphs create visibly larger inter-word gaps.
  const configuredSourceTemplateFontFamilies = [
    payload.style?.font_family,
    payload.style?.template_snapshot?.font_family,
    ...(payload.captions || []).flatMap((caption) => [
      caption?.applied_template_style?.font_family,
      caption?.custom_style?.font_family,
      ...Object.values(caption?.word_styles || {}).map((wordStyle) => wordStyle?.fontFamily),
    ]),
  ];
  configuredSourceTemplateFontFamilies.forEach((fontFamily) => {
    const family = String(fontFamily || '').trim();
    if (
      family
      && !/^(?:inherit|initial|unset|var\(|sans-serif|serif|monospace|cursive)$/i.test(family)
    ) {
      sourceTemplateFontFamilies.add(family);
    }
  });
  const scriptSamples = new Map();
  (payload.captions || []).forEach((caption) => {
    const script = caption?.__export_script || 'latin';
    if (script !== 'latin' && !scriptSamples.has(script)) {
      scriptSamples.set(script, String(caption?.text || ''));
    }
  });
  const exportScriptFontMaps = {};
  scriptSamples.forEach((sampleText, script) => {
    const families = {};
    sourceTemplateFontFamilies.forEach((fontFamily) => {
      families[fontFamily] = resolveScriptFontFamily(fontFamily, sampleText);
    });
    // applySourceTemplateScriptFonts() runs on every render and reads the
    // family it already applied (e.g. Inter -> Poppins on Hindi). Without an
    // entry for that resolved family, the second pass fell through to the
    // generic fallback, so captions exported in Noto Sans Devanagari while the
    // editor showed Poppins.
    Object.values(families).forEach((resolvedFamily) => {
      if (!(resolvedFamily in families)) {
        families[resolvedFamily] = resolveScriptFontFamily(resolvedFamily, sampleText);
      }
    });
    exportScriptFontMaps[script] = {
      fallback: resolveScriptFontFamily('', sampleText),
      families,
    };
  });
  const exportFontFamilies = new Set([
    payload.style?.font_family,
    ...(payload.captions || []).flatMap((caption) => [
      caption?.applied_template_style?.font_family,
      caption?.custom_style?.font_family,
    ]),
    ...sourceTemplateFontFamilies,
    ...Object.values(exportScriptFontMaps).flatMap((config) => [
      config.fallback,
      ...Object.values(config.families),
    ]),
  ].filter(Boolean));
  const remoteExportFontFamilies = [...exportFontFamilies].filter(needsRemoteRenderFont);
  const exportFontQuery = remoteExportFontFamilies
    .map((fontFamily) => googleFontFamilyParam(fontFamily))
    .join('&');
  const exportFontLinks = exportFontQuery
    ? `<link href="https://fonts.googleapis.com/css2?${exportFontQuery}&display=swap" rel="stylesheet">`
    : '';
  console.log(`[Template DOM] sizing preview_width=${previewWidth || 'missing'} video_width=${payload.video_width} css_scale=${exportCssScale.toFixed(4)} target_box=${exportTemplateBoxTargetWidthPx ? `${exportTemplateBoxTargetWidthPx.toFixed(2)}x${exportTemplateBoxTargetHeightPx.toFixed(2)}` : 'auto'}`);
  const runtimeCss = `
    ${sidebarTemplateCss}
    ${ADVANCED_TEMPLATE_RUNTIME_CSS}

    html, body {
      /* The LC / legacy template sheets loaded into this page carry their
         gallery's body{padding:28px 22px …}; it shifted every exported caption
         right and down of the canvas. The overlay page is always edge to edge. */
      margin: 0 !important;
      padding: 0 !important;
      width: 100%;
      height: 100%;
      background: transparent !important;
      overflow: hidden;
      font-size: ${exportRootFontSize}px;
    }
    body {
      font-family: 'Inter', sans-serif;
      font-size: ${exportRootFontSize}px;
    }
    #overlay-root {
      position: relative;
      width: ${payload.video_width}px;
      height: ${payload.video_height}px;
      background: transparent;
      overflow: hidden;
    }
    .template-caption-shell,
    .plain-caption-shell {
      position: relative;
      display: inline-block;
      max-width: 100%;
    }
    .lekha-sidebar-export-template-shell {
      display: inline-block;
      width: ${exportSidebarWidth}px;
      height: auto;
      max-width: none;
      min-height: 0;
      /* Preview never crops the applied template (matras, descenders, entrance
         motion all paint freely) — keep the export shell unclipped to match. */
      overflow: visible;
      background: transparent !important;
      pointer-events: none;
      color: #fff;
    }
    .lekha-sidebar-export-template-shell .card,
    .lekha-sidebar-export-template-shell .lk-card {
      display: block !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      aspect-ratio: auto !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .lekha-sidebar-export-template-shell .lk-card {
      display: grid !important;
      grid-template-rows: 1fr !important;
    }
    .lekha-sidebar-export-template-shell .card-top,
    .lekha-sidebar-export-template-shell .dots,
    .lekha-sidebar-export-template-shell .lk-card-top,
    .lekha-sidebar-export-template-shell .lk-dots,
    .lekha-sidebar-export-template-shell .slbl,
    .lekha-sidebar-export-template-shell .lk-lbl,
    .lekha-sidebar-export-template-shell .stage-lbl,
    .lekha-sidebar-export-template-shell .lk-phase-chip {
      display: none !important;
    }
    .lekha-sidebar-export-template-shell .stage,
    .lekha-sidebar-export-template-shell .lk-stage {
      position: relative !important;
      inset: auto !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      aspect-ratio: auto !important;
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .lekha-sidebar-export-template-shell[data-template-source="lekha-lc"] .lc-card .stage {
      height: ${exportSidebarHeight}px !important;
      aspect-ratio: auto !important;
    }
    .lekha-sidebar-export-template-shell[data-template-source="lekha-lc"] {
      height: auto !important;
      min-height: 0 !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .stage::after {
      content: none !important;
      display: none !important;
      box-shadow: none !important;
      background: transparent !important;
    }
    .lekha-sidebar-export-template-shell[data-template-source="lekha-lc"] .lc-card .sb {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }
    .lekha-sidebar-export-template-shell.is-color-customized .lc-card .sb {
      --template-highlight: var(--sidebar-template-highlight, var(--sidebar-emphasis-accent, #DDAA03)) !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb:not(.active) {
      position: absolute !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    .lekha-sidebar-export-template-shell[data-template-source="lekha-lc"] .lc-card .cap {
      position: absolute !important;
      left: 50% !important;
      top: 52% !important;
      transform: translate(-50%, -50%) !important;
      width: 88% !important;
      max-width: 88% !important;
      text-align: center !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .scene,
    .lekha-sidebar-export-template-shell .lc-card .cpt,
    .lekha-sidebar-export-template-shell .lc-card .nline,
    .lekha-sidebar-export-template-shell .lc-card .plain-s {
      width: fit-content !important;
      max-width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
    .lekha-sidebar-export-template-shell .card[class] .stage,
    .lekha-sidebar-export-template-shell .lk-card[class] .lk-stage {
      background: transparent !important;
      box-shadow: none !important;
    }
    .lekha-sidebar-export-template-shell .sw,
    .lekha-sidebar-export-template-shell .wbw-word,
    .lekha-sidebar-export-template-shell .sw-w,
    .lekha-sidebar-export-template-shell .w,
    .lekha-sidebar-export-template-shell .plain-s,
    .lekha-sidebar-export-template-shell .wbw,
    .lekha-sidebar-export-template-shell .wbw-line,
    .lekha-sidebar-export-template-shell [class^='pos'],
    .lekha-sidebar-export-template-shell [class*=' pos'] {
      font-family: var(--sidebar-source-font, inherit) !important;
    }
    .lekha-sidebar-export-template-shell .sw,
    .lekha-sidebar-export-template-shell .wbw-word,
    .lekha-sidebar-export-template-shell .sw-w,
    /* LC merged lines (splice, baseline, serifbreak, weld) size each word with
       its own class (xs/s/m/h/xh); the canvas keeps that size, so it must not
       be reset to the line's here. */
    .lekha-sidebar-export-template-shell .w:not(.xs):not(.s):not(.m):not(.h):not(.xh),
    .lekha-sidebar-export-template-shell .plain-s,
    .lekha-sidebar-export-template-shell .wbw,
    .lekha-sidebar-export-template-shell .wbw-line,
    .lekha-sidebar-export-template-shell [class^='pos'],
    .lekha-sidebar-export-template-shell [class*=' pos'] {
      font-size: inherit !important;
      line-height: inherit !important;
    }
    .lekha-sidebar-export-template-shell .sb,
    .lekha-sidebar-export-template-shell .sblock {
      position: relative !important;
      inset: auto !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      padding: 0 !important;
      margin: 0 auto !important;
      opacity: 0 !important;
      pointer-events: none !important;
      background: transparent !important;
      visibility: hidden;
    }
    .lekha-sidebar-export-template-shell .sb.active,
    .lekha-sidebar-export-template-shell .sblock.active {
      opacity: 1 !important;
      visibility: visible;
    }
    .lekha-sidebar-export-template-shell .w,
    .lekha-sidebar-export-template-shell .wbw-word,
    .lekha-sidebar-export-template-shell .sw,
    .lekha-sidebar-export-template-shell .sw-w {
      display: inline-block;
      backface-visibility: hidden;
      will-change: transform, opacity, clip-path;
      overflow: visible !important;
      padding-block: 0.18em;
      margin-block: 0;
    }
    .lekha-sidebar-export-template-shell .w:not(:last-child),
    .lekha-sidebar-export-template-shell .wbw-word:not(:last-child),
    .lekha-sidebar-export-template-shell .sw:not(:last-child),
    .lekha-sidebar-export-template-shell .sw-w:not(:last-child) {
      margin-inline-end: 0.12em;
    }
    /* Flow word-lines laid out with flex/grid drop the literal space between word
       spans (whitespace-only text nodes are not flex items), so Devanagari words
       touched. A column gap restores spacing and is inert on non-flex lines.
       Mirrors the preview fix in VideoPlayer.jsx so export matches the canvas. */
    .lekha-sidebar-export-template-shell .wbw,
    .lekha-sidebar-export-template-shell .wbw-line,
    .lekha-sidebar-export-template-shell .sw-line {
      column-gap: 0.28em;
    }
    .lekha-sidebar-export-template-shell .is-emphasis {
      display: inline-block !important;
      font-size: inherit !important;
      line-height: inherit !important;
      vertical-align: baseline !important;
      color: var(--sidebar-emphasis-accent, #DDAA03) !important;
      -webkit-text-fill-color: var(--sidebar-emphasis-accent, #DDAA03) !important;
    }
    /* Mirrors the preview: words sharing a keyword row are not keywords. */
    .lekha-sidebar-export-template-shell .ln.hero:not(.box) > .w:not(.is-emphasis) {
      color: var(--template-primary, #FFFFFF) !important;
      -webkit-text-fill-color: var(--template-primary, #FFFFFF) !important;
    }
    .lekha-sidebar-export-template-shell [data-paired-emphasis-underline='true'] {
      border-bottom: 0.055em solid currentColor !important;
      padding-bottom: 0.05em !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb .hero,
    .lekha-sidebar-export-template-shell .lc-card .sb .is-emphasis,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3hero,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3box,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3mark,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3bracket,
    .lekha-sidebar-export-template-shell .lc-card .sb .ns3dot,
    .lekha-sidebar-export-template-shell .lc-card .sb [data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
      filter: saturate(1.35) brightness(1.12);
      font-weight: 900;
    }
    .lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card .cpt.dropcap > .ln:first-child {
      position: relative !important;
      top: 0.18em !important;
    }
    .lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card .ns3box {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1.05 !important;
      padding-block: 0.12em 0.04em !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
    }
    .lekha-sidebar-export-template-shell[data-template-complex-script='true'] .lc-card .cpt .ln.box {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1.16 !important;
      padding-block: 0.14em 0.06em !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .cpt {
      --hc: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb .box {
      background: var(--template-highlight, var(--lc-scene-highlight, var(--sidebar-emphasis-accent, #DDAA03))) !important;
      color: #101114 !important;
      -webkit-text-fill-color: #101114 !important;
    }
    .lekha-sidebar-export-template-shell .lc-card .sb .box .sw,
    .lekha-sidebar-export-template-shell .lc-card .sb .box .hero {
      color: #101114 !important;
      -webkit-text-fill-color: #101114 !important;
    }
    .lekha-sidebar-export-template-shell .stage .w[class*='imp-'],
    .lekha-sidebar-export-template-shell .stage .w[class*='ns2-'],
    .lekha-sidebar-export-template-shell .stage .w[class*='ns3-'],
    .lekha-sidebar-export-template-shell .stage .wbw-word[class*='imp-'],
    .lekha-sidebar-export-template-shell .stage .wbw-word[class*='ns2-'],
    .lekha-sidebar-export-template-shell .stage .wbw-word[class*='ns3-'] {
      display: inline-block !important;
      font-size: inherit !important;
      line-height: inherit !important;
      overflow: visible !important;
      padding-block: 0.18em !important;
      vertical-align: baseline !important;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-word-anim,
    .lekha-sidebar-export-template-shell .sidebar-export-sw-anim {
      animation-name: lekhaSidebarExportWordIn;
      animation-duration: var(--sidebar-export-word-duration, 280ms);
      animation-delay: var(--sidebar-export-word-delay, 0ms);
      animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
      animation-fill-mode: both;
      animation-play-state: running;
    }
    .lekha-sidebar-export-template-shell .imp-flicker.sidebar-export-word-anim {
      animation-name: lekhaSidebarExportFlicker;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-lc-anim {
      animation-name: var(--sidebar-export-lc-animation, fade);
      animation-duration: var(--sidebar-export-word-duration, 180ms);
      animation-delay: var(--sidebar-export-word-delay, 0ms);
      animation-timing-function: var(--sidebar-export-lc-ease, cubic-bezier(.22,.68,.26,1));
      animation-fill-mode: both;
      animation-play-state: running;
    }
    .lekha-sidebar-export-template-shell .sidebar-export-sticky-anim {
      animation: lekhaSidebarExportStickyIn ${LEGACY_TEMPLATE_TIMING.positionedWordDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--sidebar-export-word-delay, 0ms);
    }
    /* Scoped to the contexts this rule was written for (plain captions + the
       right-side original templates). It must NOT leak into the sidebar template
       shells: their source CSS lays .plain-s/.wbw out as plain text flow
       (line-height 1.55–1.7), and inline-flex drops the whitespace text nodes
       around the .is-emphasis span — words touch and lines compress vs preview. */
    .cap-text,
    .lekha-original-template .plain-s,
    .lekha-original-template .wbw-rise,
    .lekha-original-template .wbw-slide {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      column-gap: 0.24em;
      row-gap: 0.08em;
      line-height: 1.2;
    }
    .lekha-original-template {
      --gold: #d4af37;
      --rose: #ff3d71;
      --cyan: #00e5ff;
      --green: #39ff14;
      --purple: #a78bfa;
      --white: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${exportMeasuredAdvancedTemplateWidthPx ? `${exportMeasuredAdvancedTemplateWidthPx}px` : 'auto'};
      max-width: min(82vw, ${exportTemplateMaxWidth}px);
      color: #fff;
      text-align: center;
      pointer-events: none;
    }
    .lekha-original-template[class*='t'][class*='-stage'] {
      background: transparent !important;
      box-shadow: none !important;
    }
    .lekha-original-template .sblock {
      position: relative !important;
      inset: auto !important;
      display: inline-flex !important;
      width: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
      opacity: 1;
      padding: 0 !important;
      overflow: visible !important;
      white-space: normal;
      max-width: 100% !important;
    }
    .lekha-original-template .lekha-applied-advanced-template {
      font-size: ${exportAdvancedTemplateFontPx}px;
    }
    /* T41–T52 size every decoration in em: one scale input, same formula as
       the canvas (scaleTemplateFontSize(font_size) x render scale). */
    .lekha-original-template:is(
      .t41-stage, .t42-stage, .t43-stage, .t44-stage, .t45-stage, .t46-stage,
      .t47-stage, .t48-stage, .t49-stage, .t50-stage, .t51-stage, .t52-stage
    ) .lekha-applied-advanced-template {
      font-size: ${exportAdvancedTemplateFontPx}px !important;
    }
    .lekha-original-template .lekha-template-fit {
      display: inline-block;
      max-width: 100%;
    }
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t16-stage,
      .t17-stage,
      .t24-stage
    ) .wbw-rise,
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t16-stage,
      .t17-stage,
      .t24-stage
    ) .wbw-slide,
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t16-stage,
      .t17-stage,
      .t24-stage
    ) .wbw-seq-fade {
      flex-wrap: nowrap !important;
      white-space: nowrap !important;
    }
    .lekha-original-template.t29-stage .lekha-applied-advanced-template,
    .lekha-original-template.t29-stage .lekha-template-fit {
      max-width: min(84vw, 11.5em) !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
      line-height: 1.12 !important;
      font-size: min(${exportAdvancedTemplateFontPx}px, 26px) !important;
    }
    .lekha-original-template.t29-stage .wbw-rise,
    .lekha-original-template.t29-stage .wbw-slide {
      flex-wrap: wrap !important;
      row-gap: 0.04em !important;
    }
    .lekha-original-template .wbw-rise,
    .lekha-original-template .wbw-slide,
    .lekha-original-template .wbw-seq,
    .lekha-original-template .wbw-seq-fade,
    .lekha-original-template .wbw-seq-flip {
      max-width: 100%;
      white-space: normal;
    }
    .lekha-original-template .lekha-template-preview-lines {
      display: block !important;
      text-align: center !important;
      line-height: 1.2 !important;
    }
    .lekha-original-template .lekha-template-preview-line {
      display: block !important;
      white-space: nowrap !important;
      text-align: center !important;
    }
    .lekha-original-template .cluster-wrap {
      align-items: stretch;
    }
    .lekha-original-template.t11-stage .lekha-applied-advanced-template,
    .lekha-original-template.t11-stage .lekha-template-fit,
    .lekha-original-template.t11-stage .lekha-template-preview-lines,
    .lekha-original-template.t11-stage .lekha-template-preview-line,
    .lekha-original-template.t11-stage .wbw-rise,
    .lekha-original-template.t11-stage .wbw-slide,
    .lekha-original-template.t11-stage .wbw-seq-fade,
    .lekha-original-template.t11-stage .w,
    .lekha-original-template.t11-stage .cluster-row-top,
    .lekha-original-template.t11-stage .cluster-row-bot,
    .lekha-original-template.t11-stage .cluster-hl,
    .lekha-original-template.t11-stage .blur-txt {
      font-size: 1em !important;
      line-height: 1.28 !important;
    }

    .lekha-original-template.t11-stage .t11-b0 .cluster-row-top,
    .lekha-original-template.t11-stage .t11-b0 .cluster-row-bot,
    .lekha-original-template.t11-stage .t11-b1,
    .lekha-original-template.t11-stage .t11-b1 .blur-txt,
    .lekha-original-template.t11-stage .t11-b2,
    .lekha-original-template.t11-stage .t11-b2 .lekha-template-fit,
    .lekha-original-template.t11-stage .t11-b3 .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t13-stage .t13-b0 .slide-crash,
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt,
    .lekha-original-template.t13-stage .w.in {
      font-family: 'IBM Plex Mono', monospace !important;
      font-weight: 700 !important;
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t13-stage .t13-b2 .w.in:not([data-imp='true']),
    .lekha-original-template.t13-stage .t13-b3 .w.in:not([data-imp='true']) {
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t13-stage .imp-cyan,
    .lekha-original-template.t13-stage .imp-bold,
    .lekha-original-template.t13-stage .w.in[data-imp='true'],
    .lekha-original-template.t13-stage .w[data-hero-emphasis='true'],
    .lekha-original-template.t13-stage .slide-crash .is-emphasis,
    .lekha-original-template.t13-stage .ticker-txt .is-emphasis {
      font-weight: 900 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-shadow: 0 0 12px rgba(255,255,255,0.35) !important;
    }
    .lekha-original-template.t13-stage .lekha-applied-advanced-template,
    .lekha-original-template.t13-stage .lekha-template-fit,
    .lekha-original-template.t13-stage .wbw-rise,
    .lekha-original-template.t13-stage .wbw-slide,
    .lekha-original-template.t13-stage .wbw-seq-fade,
    .lekha-original-template.t13-stage .t13-b0 .slide-crash,
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      align-items: center !important;
      max-width: min(100%, 13.5em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      line-height: 1.2 !important;
      letter-spacing: 0.02em !important;
      text-align: center !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
    .lekha-original-template.t13-stage .t13-b0 .slide-crash.t13-compact-line,
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt.t13-compact-line {
      max-width: min(100%, 12em) !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      text-transform: none !important;
    }
    .lekha-original-template.t13-stage .t13-b0 .slide-crash.t13-compact-line {
      font-size: 1.12rem !important;
    }
    .lekha-original-template.t13-stage .t13-b1 .ticker-txt.t13-compact-line {
      font-size: 0.98rem !important;
    }
    .lekha-original-template.t15-stage .lekha-applied-advanced-template,
    .lekha-original-template.t15-stage .lekha-template-fit,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t15-stage .pop-txt,
    .lekha-original-template.t15-stage .wbw-rise,
    .lekha-original-template.t15-stage .wbw-seq-fade,
    .lekha-original-template.t15-stage .w.in {
      font-size: ${Math.max(14, Math.round(exportAdvancedTemplateFontPx * 0.88))}px !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template.t15-stage .shake-in > br {
      display: block !important;
      content: '' !important;
    }
    .lekha-original-template.t35-stage .lekha-applied-advanced-template,
    .lekha-original-template.t35-stage .lekha-template-fit,
    .lekha-original-template.t35-stage .secret-txt {
      display: inline-block !important;
      max-width: min(100%, 12.5em) !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
      line-height: 1.22 !important;
      text-align: center !important;
    }
    .lekha-original-template.t14-stage .t14-block,
    .lekha-original-template.t14-stage .t14-b0 .flip-line,
    .lekha-original-template.t14-stage .t14-b1 .drop-txt,
    .lekha-original-template.t14-stage .t14-b2,
    .lekha-original-template.t14-stage .t14-b2 span,
    .lekha-original-template.t14-stage .t14-b3 .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t14-stage .t14-block,
    .lekha-original-template.t14-stage .t14-b0,
    .lekha-original-template.t14-stage .t14-b1,
    .lekha-original-template.t14-stage .t14-b2,
    .lekha-original-template.t14-stage .t14-b3 {
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.38 !important;
    }
    .lekha-original-template.t16-stage .t16-block,
    .lekha-original-template.t16-stage .neon-line,
    .lekha-original-template.t16-stage .wbw-rise,
    .lekha-original-template.t16-stage .wbw-slide {
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.3 !important;
    }
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t14-stage,
      .t16-stage,
      .t17-stage,
      .t18-stage,
      .t19-stage,
      .t22-stage,
      .t24-stage,
      .t25-stage,
      .t26-stage,
      .t27-stage,
      .t29-stage,
      .t31-stage,
      .t33-stage,
      .t34-stage
    ) .lekha-template-fit:not(.t13-compact-line),
    .lekha-original-template:is(
      .t11-stage,
      .t13-stage,
      .t14-stage,
      .t16-stage,
      .t17-stage,
      .t18-stage,
      .t19-stage,
      .t22-stage,
      .t24-stage,
      .t25-stage,
      .t26-stage,
      .t27-stage,
      .t29-stage,
      .t31-stage,
      .t33-stage,
      .t34-stage
    ) .w.in,
    .lekha-original-template:is(
      .t22-stage,
      .t24-stage,
      .t33-stage
    ) .kf-line,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t22-stage .wave-txt,
    .lekha-original-template.t24-stage .redact-wrap,
    .lekha-original-template.t25-stage .hand-txt,
    .lekha-original-template.t25-stage .soft-rise,
    .lekha-original-template.t26-stage .hard-txt,
    .lekha-original-template.t26-stage .fast-slide,
    .lekha-original-template.t29-stage .battle-slide,
    .lekha-original-template.t29-stage .hard-rise,
    .lekha-original-template.t31-stage .stamp-text,
    .lekha-original-template.t33-stage .doc-line,
    .lekha-original-template.t34-stage .pow-txt {
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.32 !important;
    }
    .lekha-original-template.t15-stage .lekha-applied-advanced-template,
    .lekha-original-template.t15-stage .lekha-template-fit,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t15-stage .pop-txt,
    .lekha-original-template.t15-stage .wbw-rise,
    .lekha-original-template.t15-stage .wbw-seq-fade,
    .lekha-original-template.t15-stage .w.in {
      font-size: ${Math.max(14, Math.round(exportAdvancedTemplateFontPx * 0.88))}px !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template .wbw-rise .w,
    .lekha-original-template .wbw-slide .w,
    .lekha-original-template .wbw-seq .w,
    .lekha-original-template .wbw-seq-fade .w {
      opacity: 0;
      display: inline-block;
      transition: none;
    }
    .lekha-original-template .wbw-rise .w,
    .lekha-original-template .wbw-seq .w,
    .lekha-original-template .wbw-seq-fade .w {
      transform: translateY(20px);
    }
    .lekha-original-template .wbw-slide .w {
      transform: translateX(-16px);
    }
    .lekha-original-template .active .wbw-rise .w.in,
    .lekha-original-template .active .wbw-slide .w.in,
    .lekha-original-template .active .wbw-seq .w.in,
    .lekha-original-template .active .wbw-seq-fade .w.in {
      animation: lekhaTemplateWbwIn 320ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
      animation-delay: var(--wbw-delay, 0ms);
    }
    .lekha-original-template .active .wbw-rise .w[data-imp='true'].in,
    .lekha-original-template .active .wbw-slide .w[data-imp='true'].in,
    .lekha-original-template .active .wbw-seq .w[data-imp='true'].in,
    .lekha-original-template .active .wbw-seq-fade .w[data-imp='true'].in {
      animation-duration: 440ms;
    }
    .lekha-original-template.t29-stage .battle-sweep-left .w {
      transform: translateX(-34px);
    }
    .lekha-original-template.t29-stage .battle-lift-up .w {
      transform: translateY(28px);
    }
    .lekha-original-template.t29-stage .active .battle-sweep-left .w.in,
    .lekha-original-template.t29-stage .active .battle-lift-up .w.in {
      animation: lekhaTemplateWbwIn 360ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: var(--wbw-delay, 0ms);
    }
    .lekha-original-template.t29-stage .active .battle-sweep-left .w[data-imp='true'].in,
    .lekha-original-template.t29-stage .active .battle-lift-up .w[data-imp='true'].in {
      animation-duration: 400ms;
    }
    .lekha-original-template .lekha-applied-advanced-template.t22-block,
    .lekha-original-template .lekha-applied-advanced-template.t28-block,
    .lekha-original-template .lekha-applied-advanced-template.t22-block .wave-txt,
    .lekha-original-template .lekha-applied-advanced-template.t28-block .grain-txt,
    .lekha-original-template .lekha-applied-advanced-template.t28-block .slow-fade,
    .lekha-original-template .lekha-applied-advanced-template.t22-block .w.in:not([data-imp='true']),
    .lekha-original-template .lekha-applied-advanced-template.t28-block .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .lekha-original-template .lekha-applied-advanced-template.active .karaoke-base {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      opacity: 1 !important;
    }
    .lekha-original-template .imp-gold {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
    }
    .lekha-original-template .imp-rose {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
    }
    .lekha-original-template .imp-cyan {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
    }
    .lekha-original-template .imp-purple {
      color: var(--purple) !important;
      -webkit-text-fill-color: var(--purple) !important;
    }
    .lekha-original-template .imp-green {
      color: var(--green) !important;
      -webkit-text-fill-color: var(--green) !important;
    }
    .lekha-original-template .is-emphasis {
      color: var(--template-secondary, var(--gold)) !important;
      -webkit-text-fill-color: currentColor !important;
      font-weight: 900;
      text-shadow: 0 0 14px color-mix(in srgb, currentColor 48%, transparent);
    }
    .lekha-original-template.t14-stage .imp-gold,
    .lekha-original-template.t14-stage .is-emphasis {
      color: #D4AF37 !important;
      -webkit-text-fill-color: #D4AF37 !important;
      opacity: 1 !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 14px rgba(212,175,55,0.36) !important;
    }
    .lekha-original-template.t14-stage .imp-underline {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      position: relative !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t14-stage .imp-underline::after {
      content: '' !important;
      position: absolute !important;
      left: 0 !important;
      bottom: -2px !important;
      width: 100% !important;
      height: max(2px, 0.08em) !important;
      background: #D4AF37 !important;
      display: block !important;
      opacity: 1 !important;
      clip-path: inset(0 0 0 0) !important;
    }
    .lekha-original-template.t38-stage .imp-underline,
    .lekha-original-template.t38-stage .w[data-imp='true'].imp-underline {
      position: relative !important;
      display: inline-block !important;
      font-weight: 900 !important;
      color: var(--template-secondary, var(--gold, #d4af37)) !important;
      -webkit-text-fill-color: currentColor !important;
      text-shadow: 0 0 14px color-mix(in srgb, currentColor 48%, transparent) !important;
      overflow: visible !important;
    }
    .lekha-original-template.t38-stage .imp-underline::after,
    .lekha-original-template.t38-stage .w[data-imp='true'].imp-underline::after {
      content: '' !important;
      position: absolute !important;
      left: 0 !important;
      bottom: -2px !important;
      width: 100% !important;
      height: max(2px, 0.08em) !important;
      background: var(--gold, #d4af37) !important;
      display: block !important;
      opacity: 1 !important;
      clip-path: inset(0 0 0 0) !important;
    }
    .lekha-original-template.t16-stage .t16-block,
    .lekha-original-template.t16-stage .neon-line {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t16-stage .wbw-rise .w,
    .lekha-original-template.t16-stage .wbw-slide .w {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
    }
    .lekha-original-template.t16-stage .w[data-imp='true'],
    .lekha-original-template.t16-stage .imp-bold,
    .lekha-original-template.t16-stage .is-emphasis {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .lekha-original-template.t16-stage .imp-bold:not(.w),
    .lekha-original-template.t16-stage .is-emphasis:not(.w) {
      opacity: 1 !important;
    }
    .lekha-original-template.t12-stage .imp-purple {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
    }
    .lekha-original-template.t15-stage .t15-block,
    .lekha-original-template.t15-stage .shake-in,
    .lekha-original-template.t15-stage .pop-txt,
    .lekha-original-template.t15-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t15-stage .imp-rose,
    .lekha-original-template.t15-stage .imp-bold,
    .lekha-original-template.t15-stage .w.in[data-imp='true'],
    .lekha-original-template.t15-stage .w[data-hero-emphasis='true'] {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t15-stage .shake-in {
      line-height: 1.48 !important;
    }
    .lekha-original-template.t17-stage .t17-block,
    .lekha-original-template.t17-stage .t17-b2 .lekha-template-fit,
    .lekha-original-template.t17-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t17-stage .glitch-wrap,
    .lekha-original-template.t17-stage .t17-b0 .lekha-template-fit,
    .lekha-original-template.t17-stage .t17-b2 .lekha-template-fit,
    .lekha-original-template.t17-stage .wbw-rise .w.in,
    .lekha-original-template.t17-stage .wbw-slide .w.in,
    .lekha-original-template.t17-stage .wbw-seq-fade .w.in {
      font-size: max(${exportAdvancedTemplateFontPx}px, 20px) !important;
      line-height: 1.32 !important;
    }
    .lekha-original-template.t17-stage .imp-flicker,
    .lekha-original-template.t17-stage .w.in[data-imp='true'],
    .lekha-original-template.t17-stage .w[data-hero-emphasis='true'] {
      color: #ff3d71 !important;
      -webkit-text-fill-color: #ff3d71 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t17-stage .letter-snap-blk,
    .lekha-original-template.t17-stage .snap-txt {
      opacity: 1 !important;
      filter: none !important;
    }
    .lekha-original-template.t17-stage .snap-txt,
    .lekha-original-template.t17-stage .snap-txt * {
      color: #ff3d71 !important;
      -webkit-text-fill-color: #ff3d71 !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.82), 0 0 2px rgba(0,0,0,0.92), 0 0 16px rgba(255,61,113,0.22) !important;
    }
    .lekha-original-template.t18-stage .imp-purple {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
    }
    .lekha-original-template.t18-stage .t18-block {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-align: center !important;
      letter-spacing: 0.06em !important;
    }
    .lekha-original-template.t18-stage .split-title {
      display: inline-block !important;
      text-align: center !important;
      font-size: max(1em, 1.65rem) !important;
      line-height: 1.2 !important;
    }
    .lekha-original-template.t18-stage .split-top {
      display: block !important;
      color: rgba(255,255,255,0.92) !important;
      -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
      font-size: 0.5em !important;
      letter-spacing: 0.18em !important;
      text-transform: uppercase !important;
    }
    .lekha-original-template.t18-stage .split-bot {
      display: block !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      font-size: 1em !important;
      font-weight: 700 !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
    }
    .lekha-original-template.t18-stage .split-bot .imp-purple,
    .lekha-original-template.t18-stage .reveal-txt .imp-purple,
    .lekha-original-template.t18-stage .w.in[data-imp='true'] {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t18-stage .reveal-txt,
    .lekha-original-template.t18-stage .t18-b2 .lekha-template-fit,
    .lekha-original-template.t18-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      filter: none !important;
    }
    .lekha-original-template.t19-stage .t19-block,
    .lekha-original-template.t19-stage .lekha-applied-advanced-template,
    .lekha-original-template.t19-stage .lekha-template-fit,
    .lekha-original-template.t19-stage .wbw-rise,
    .lekha-original-template.t19-stage .wbw-seq-fade,
    .lekha-original-template.t19-stage .rise-unit,
    .lekha-original-template.t19-stage .slash-wrap,
    .lekha-original-template.t19-stage .w,
    .lekha-original-template.t19-stage .w.in:not([data-imp='true']) {
      font-family: 'Archivo Black', sans-serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-weight: 900 !important;
      line-height: 1.32 !important;
      letter-spacing: 0.02em !important;
      text-transform: uppercase !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t19-stage .imp-rose,
    .lekha-original-template.t19-stage .imp-bold,
    .lekha-original-template.t19-stage .w.in[data-imp='true'],
    .lekha-original-template.t19-stage .w[data-hero-emphasis='true'] {
      color: var(--rose) !important;
      -webkit-text-fill-color: var(--rose) !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t19-stage .wbw-rise,
    .lekha-original-template.t19-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      max-width: min(100%, 12em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
    }
    .lekha-original-template.t22-stage .t22-block,
    .lekha-original-template.t22-stage .wave-txt,
    .lekha-original-template.t22-stage .kf-line,
    .lekha-original-template.t22-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t22-stage .kf-base {
      color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      paint-order: fill !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t22-stage .imp-gold,
    .lekha-original-template.t22-stage .imp-italic,
    .lekha-original-template.t22-stage .kf-fill,
    .lekha-original-template.t22-stage .w.in[data-imp='true'],
    .lekha-original-template.t22-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--gold))) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      paint-order: fill !important;
      opacity: 1 !important;
    }
    .lekha-original-template .kf-line {
      display: inline-block !important;
      max-width: 100% !important;
      text-align: center !important;
      white-space: normal !important;
    }
    .lekha-original-template .kf-word {
      display: inline-block !important;
      position: relative !important;
      white-space: pre !important;
    }
    .lekha-original-template .kf-base {
      display: block !important;
      color: rgba(255, 255, 255, 0.25) !important;
      -webkit-text-fill-color: rgba(255, 255, 255, 0.25) !important;
    }
    .lekha-original-template .kf-fill {
      position: absolute !important;
      inset: 0 !important;
      display: block !important;
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      clip-path: inset(0 100% 0 0);
    }
    .lekha-original-template .active .kf-fill {
      animation: lekhaKaraokeFill var(--kf-duration, 360ms) linear forwards;
      animation-delay: var(--kf-delay, 0ms);
    }
    .lekha-original-template .t24-b4 .kf-fill {
      color: #fb923c !important;
      -webkit-text-fill-color: #fb923c !important;
    }
    .lekha-original-template .t33-b2 .kf-fill {
      color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #ee17dc)) !important;
    }
    .lekha-original-template .t33-b2 .kf-base {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }
    .lekha-original-template.t36-stage .t36-b0 .kf-fill {
      color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
      -webkit-text-fill-color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
    }
    .lekha-original-template.t36-stage .t36-b1 .kf-fill {
      color: var(--template-karaoke-2, #22D3EE) !important;
      -webkit-text-fill-color: var(--template-karaoke-2, #22D3EE) !important;
    }
    .lekha-original-template.t36-stage .t36-b2 .kf-fill {
      color: var(--template-karaoke-3, #FB923C) !important;
      -webkit-text-fill-color: var(--template-karaoke-3, #FB923C) !important;
    }
    .lekha-original-template.t23-stage .t23-b3 .imp-bold,
    .lekha-original-template.t23-stage .t23-b3 .imp-gold,
    .lekha-original-template.t23-stage .t23-b3 .is-emphasis {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36) !important;
    }
    .lekha-original-template.t24-stage .imp-purple {
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
    }
    .lekha-original-template.t24-stage .t24-block,
    .lekha-original-template.t24-stage .lekha-applied-advanced-template,
    .lekha-original-template.t24-stage .lekha-template-fit {
      font-size: min(${exportAdvancedTemplateFontPx}px, 20px) !important;
      line-height: 1.28 !important;
      max-width: min(100%, ${exportT24TemplateMaxWidthPx}px) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }

    .lekha-original-template.t24-stage {
      width: auto !important;
      max-width: min(82vw, ${exportT24TemplateMaxWidthPx}px) !important;
    }

    .lekha-original-template.t24-stage .wbw-rise,
    .lekha-original-template.t24-stage .wbw-slide,
    .lekha-original-template.t24-stage .wbw-seq-fade,
    .lekha-original-template.t24-stage .kf-line,
    .lekha-original-template.t24-stage .slow-rise,
    .lekha-original-template.t24-stage .rw {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.28em !important;
      row-gap: 0.12em !important;
      max-width: min(100%, ${exportT24TemplateMaxWidthPx}px) !important;
      text-align: center !important;
    }

    .lekha-original-template.t24-stage .lekha-template-preview-lines {
      display: block !important;
      line-height: 1.28 !important;
      max-width: min(100%, ${exportT24TemplateMaxWidthPx}px) !important;
      text-align: center !important;
    }

    .lekha-original-template.t24-stage .lekha-template-preview-line {
      display: block !important;
      white-space: nowrap !important;
      line-height: 1.28 !important;
      text-align: center !important;
    }

    .lekha-original-template.t24-stage .w,
    .lekha-original-template.t24-stage .w.in:not([data-imp='true']) {
      display: inline-block !important;
      margin-right: 0 !important;
      font-size: 1em !important;
      line-height: 1.28 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t24-stage .redact-block,
    .lekha-original-template.t24-stage .imp-purple,
    .lekha-original-template.t24-stage .imp-orange,
    .lekha-original-template.t24-stage .w.in[data-imp='true'],
    .lekha-original-template.t24-stage .w[data-hero-emphasis='true'] {
      color: #f97316 !important;
      -webkit-text-fill-color: #f97316 !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t24-stage .slow-rise {
      font-size: min(${exportAdvancedTemplateFontPx}px, 20px) !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template.t25-stage .t25-block,
    .lekha-original-template.t25-stage .lekha-applied-advanced-template,
    .lekha-original-template.t25-stage .lekha-template-fit,
    .lekha-original-template.t25-stage .hand-txt,
    .lekha-original-template.t25-stage .soft-rise,
    .lekha-original-template.t25-stage .wbw-rise,
    .lekha-original-template.t25-stage .wbw-slide,
    .lekha-original-template.t25-stage .w.in:not([data-imp='true']) {
      max-width: min(100%, 13em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t25-stage .hand-txt,
    .lekha-original-template.t25-stage .soft-rise {
      display: inline-block !important;
      line-height: 1.55 !important;
    }

    .lekha-original-template.t25-stage .lekha-template-preview-lines {
      display: block !important;
      line-height: 1.55 !important;
      max-width: min(100%, 13em) !important;
      text-align: center !important;
    }

    .lekha-original-template.t25-stage .lekha-template-preview-line {
      display: block !important;
      white-space: nowrap !important;
      line-height: 1.55 !important;
      text-align: center !important;
    }

    .lekha-original-template.t25-stage .wbw-rise,
    .lekha-original-template.t25-stage .wbw-slide {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.28em !important;
      row-gap: 0.12em !important;
    }
    .lekha-original-template.t25-stage .w {
      margin-right: 0 !important;
    }
    .lekha-original-template.t25-stage .imp-italic,
    .lekha-original-template.t25-stage .imp-rose,
    .lekha-original-template.t25-stage .w.in[data-imp='true'],
    .lekha-original-template.t25-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, var(--rose, #ff3d71))) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t26-stage .t26-block,
    .lekha-original-template.t26-stage .lekha-applied-advanced-template,
    .lekha-original-template.t26-stage .lekha-template-fit,
    .lekha-original-template.t26-stage .wbw-rise,
    .lekha-original-template.t26-stage .wbw-slide,
    .lekha-original-template.t26-stage .wbw-seq-fade,
    .lekha-original-template.t26-stage .w,
    .lekha-original-template.t26-stage .hard-txt,
    .lekha-original-template.t26-stage .fast-slide,
    .lekha-original-template.t26-stage .w.in:not([data-imp='true']) {
      max-width: min(100%, 11.5em) !important;
      white-space: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t26-stage .wbw-rise,
    .lekha-original-template.t26-stage .wbw-slide,
    .lekha-original-template.t26-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
    }
    .lekha-original-template.t26-stage .imp-rose,
    .lekha-original-template.t26-stage .imp-bold,
    .lekha-original-template.t26-stage .w.in[data-imp='true'],
    .lekha-original-template.t26-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #15f5f9)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #15f5f9)) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t27-stage .t27-block,
    .lekha-original-template.t27-stage .center-expand-txt,
    .lekha-original-template.t27-stage .t27-b1 .lekha-template-fit,
    .lekha-original-template.t27-stage .t27-b2 .lekha-template-fit,
    .lekha-original-template.t27-stage .w.in:not([data-imp='true']) {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t27-stage .imp-cyan,
    .lekha-original-template.t27-stage .imp-bold,
    .lekha-original-template.t27-stage .w.in[data-imp='true'],
    .lekha-original-template.t27-stage .w[data-hero-emphasis='true'] {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t27-stage #t27-b1,
    .lekha-original-template.t27-stage #t27-b1 span,
    .lekha-original-template.t27-stage .t27-b1 .lekha-template-fit {
      font-size: max(${exportAdvancedTemplateFontPx}px, 20px) !important;
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t28-stage .t28-block,
    .lekha-original-template.t28-stage .lekha-applied-advanced-template,
    .lekha-original-template.t28-stage .lekha-template-fit,
    .lekha-original-template.t28-stage .grain-txt,
    .lekha-original-template.t28-stage .slow-fade,
    .lekha-original-template.t28-stage .wbw-rise,
    .lekha-original-template.t28-stage .wbw-seq-fade,
    .lekha-original-template.t28-stage .w {
      font-family: 'Bitter', serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      line-height: 1.48 !important;
      color: rgba(255,255,255,0.92) !important;
      -webkit-text-fill-color: rgba(255,255,255,0.92) !important;
      opacity: 1 !important;
      max-width: min(100%, 13em) !important;
      white-space: normal !important;
      text-align: center !important;
    }
    .lekha-original-template.t28-stage .imp-gold,
    .lekha-original-template.t28-stage .imp-italic,
    .lekha-original-template.t28-stage .w.in[data-imp='true'],
    .lekha-original-template.t28-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #86de02)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #86de02)) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t29-stage .t29-block,
    .lekha-original-template.t29-stage .hard-rise,
    .lekha-original-template.t29-stage .w,
    .lekha-original-template.t29-stage .w.in:not([data-imp='true']),
      .lekha-original-template.t29-stage .lekha-template-fit {
      font-family: 'Teko', sans-serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-weight: 700 !important;
      line-height: 1.02 !important;
      letter-spacing: 0.035em !important;
      text-transform: uppercase !important;
      max-width: min(100%, 10.5em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t29-stage .battle-slide,
    .lekha-original-template.t29-stage .imp-rose,
    .lekha-original-template.t29-stage .w.in[data-imp='true'],
    .lekha-original-template.t29-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      opacity: 1 !important;
      text-shadow: 0 0 12px rgba(249,115,22,0.28) !important;
    }
    .lekha-original-template.t29-stage .wbw-rise,
    .lekha-original-template.t29-stage .wbw-slide,
    .lekha-original-template.t29-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      column-gap: 0.14em !important;
      row-gap: 0 !important;
    }
    .lekha-original-template.t30-stage .t30-block,
    .lekha-original-template.t30-stage .lekha-applied-advanced-template,
    .lekha-original-template.t30-stage .lekha-template-fit,
    .lekha-original-template.t30-stage .breathe-txt {
      font-family: 'Cormorant Garamond', serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-style: italic !important;
      font-weight: 600 !important;
      line-height: 1.62 !important;
      max-width: min(100%, 13em) !important;
      white-space: normal !important;
      text-align: center !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t30-stage .imp-italic {
      color: #b4d2c8 !important;
      -webkit-text-fill-color: #b4d2c8 !important;
    }
    .lekha-original-template.t31-stage .t31-block,
    .lekha-original-template.t31-stage .stamp-text,
    .lekha-original-template.t31-stage .flip-line,
    .lekha-original-template.t31-stage .t31-b2 .lekha-template-fit,
    .lekha-original-template.t31-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t31-stage .imp-gold,
    .lekha-original-template.t31-stage .w.in[data-imp='true'],
    .lekha-original-template.t31-stage .w[data-hero-emphasis='true'] {
      color: var(--gold) !important;
      -webkit-text-fill-color: var(--gold) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t33-stage .t33-block,
    .lekha-original-template.t33-stage .lekha-applied-advanced-template,
    .lekha-original-template.t33-stage .lekha-template-fit,
    .lekha-original-template.t33-stage .doc-line,
    .lekha-original-template.t33-stage .w,
    .lekha-original-template.t33-stage .w.in:not([data-imp='true']) {
      font-family: 'Noto Sans', sans-serif !important;
      font-size: ${exportAdvancedTemplateFontPx}px !important;
      font-weight: 700 !important;
      line-height: 1.32 !important;
      text-align: center !important;
      max-width: min(100%, 18em) !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }

    .lekha-original-template.t33-stage .wbw-rise,
    .lekha-original-template.t33-stage .wbw-slide,
    .lekha-original-template.t33-stage .wbw-seq-fade {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: baseline !important;
      justify-content: center !important;
      column-gap: 0.24em !important;
      row-gap: 0.04em !important;
      max-width: min(100%, 18em) !important;
      white-space: normal !important;
    }
    .lekha-original-template.t33-stage .imp-cyan,
    .lekha-original-template.t33-stage .imp-bold,
    .lekha-original-template.t33-stage .w.in[data-imp='true'],
    .lekha-original-template.t33-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #00e5ff)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #00e5ff)) !important;
      opacity: 1 !important;
    }
    .template-caption-shell.template-shell-t33,
    .template-caption-shell.template-shell-t33 > div,
    .template-caption-shell.template-shell-t33 > div > span {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: min(92vw, 18em) !important;
      max-width: min(92vw, 18em) !important;
      max-height: 4.4em !important;
      overflow: hidden !important;
      text-align: center !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      max-width: 100% !important;
      max-height: 2.9em !important;
      overflow: hidden !important;
      text-align: center !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .t33-block,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-applied-advanced-template,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-template-fit,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .doc-line,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .wbw-rise,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .wbw-slide,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .wbw-seq-fade,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .kf-line {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      max-width: 100% !important;
      max-height: 4.4em !important;
      overflow: hidden !important;
      font-size: ${Math.max(14, Math.round(exportAdvancedTemplateFontPx * 0.9))}px !important;
      line-height: 1.22 !important;
      text-align: center !important;
      white-space: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      column-gap: 0.22em !important;
      row-gap: 0.08em !important;
      padding: 0 !important;
      margin: 0 auto !important;
      transform: none !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-template-preview-lines,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .doc-line {
      display: grid !important;
      grid-auto-rows: min-content !important;
      gap: 0.08em !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .lekha-template-preview-line,
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .doc-line > span {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-align: center !important;
      line-height: 1.22 !important;
    }
    .template-caption-shell.template-shell-t33 .lekha-original-template.t33-stage .w {
      margin-right: 0 !important;
      font-size: 1em !important;
      line-height: 1.22 !important;
    }
    .lekha-original-template.t40-stage .still-frames-line,
    .lekha-original-template.t40-stage .still-frames-highlight,
    .lekha-original-template.t40-stage .imp-rose,
    .lekha-original-template.t40-stage .is-emphasis {
      opacity: 1 !important;
    }
    .lekha-original-template.t40-stage .still-frames-highlight,
    .lekha-original-template.t40-stage .imp-rose,
    .lekha-original-template.t40-stage .is-emphasis {
      color: var(--template-highlight, var(--template-secondary, #f2072b)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f2072b)) !important;
      text-shadow: 0 0 12px color-mix(in srgb, var(--template-highlight, var(--template-secondary, #f2072b)) 48%, transparent) !important;
    }
    .lekha-original-template.t34-stage .t34-block,
    .lekha-original-template.t34-stage .pow-txt,
    .lekha-original-template.t34-stage .w.in:not([data-imp='true']) {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t34-stage .imp-cyan,
    .lekha-original-template.t34-stage .imp-bold,
    .lekha-original-template.t34-stage .w.in[data-imp='true'],
    .lekha-original-template.t34-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #f97316)) !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t34-stage .pow-txt {
      font-size: max(${Math.max(16, Math.round(exportAdvancedTemplateFontPx * 0.96))}px, 20px) !important;
      line-height: 1.28 !important;
    }
    .lekha-original-template.t32-stage .imp-purple {
      color: var(--cyan) !important;
      -webkit-text-fill-color: var(--cyan) !important;
    }
    .lekha-original-template.t37-stage .t37-block,
    .lekha-original-template.t37-stage .neon-pulse,
    .lekha-original-template.t37-stage .neon-expand,
    .lekha-original-template.t37-stage .w.in:not([data-imp='true']) {
      color: var(--template-primary, #e1da09) !important;
      -webkit-text-fill-color: var(--template-primary, #e1da09) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      opacity: 1 !important;
    }
    .lekha-original-template.t37-stage .imp-green,
    .lekha-original-template.t37-stage .w.in[data-imp='true'] {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template {
      --gold: var(--template-secondary, #d4af37);
      --rose: var(--template-secondary, #ff3d71);
      --cyan: var(--template-secondary, #f97316);
      --green: var(--template-secondary, #39ff14);
      --purple: var(--template-secondary, #a78bfa);
      color: var(--template-primary, #ffffff) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template .lekha-applied-advanced-template,
    .template-caption-shell.is-color-customized .lekha-original-template .lekha-template-fit,
    .template-caption-shell.is-color-customized .lekha-original-template .w.in:not([data-imp='true']),
    .template-caption-shell.is-color-customized .lekha-original-template .kf-base,
    .template-caption-shell.is-color-customized .lekha-original-template .cluster-row-top,
    .template-caption-shell.is-color-customized .lekha-original-template .cluster-row-bot,
    .template-caption-shell.is-color-customized .lekha-original-template .blur-txt {
      color: var(--template-primary, #ffffff) !important;
      -webkit-text-fill-color: var(--template-primary, #ffffff) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template .is-emphasis,
    .template-caption-shell.is-color-customized .lekha-original-template [data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template .w.in[data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template [data-hero-emphasis='true'],
    .template-caption-shell.is-color-customized .lekha-original-template .imp-gold,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-rose,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-cyan,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-purple,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-green,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-orange,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-bold,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-italic,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-weight,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-space,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-flicker,
    .template-caption-shell.is-color-customized .lekha-original-template .imp-underline {
      color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .kf-base,
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .imp-gold,
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .w.in[data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template.t22-stage .w[data-hero-emphasis='true'] {
      color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
      -webkit-text-fill-color: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
      paint-order: fill !important;
      opacity: 1 !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .t36-b0 .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .t36-b0 .kf-fill {
      color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
      -webkit-text-fill-color: var(--template-karaoke-1, var(--template-highlight, #DDAA03)) !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .kf-base,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .kf-base {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      opacity: 1 !important;
      text-shadow: none !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .t36-b1 .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .t36-b1 .kf-fill {
      color: var(--template-karaoke-2, #22D3EE) !important;
      -webkit-text-fill-color: var(--template-karaoke-2, #22D3EE) !important;
    }
    .template-caption-shell .lekha-original-template.t36-stage .t36-b2 .kf-fill,
    .template-caption-shell.is-color-customized .lekha-original-template.t36-stage .t36-b2 .kf-fill {
      color: var(--template-karaoke-3, #FB923C) !important;
      -webkit-text-fill-color: var(--template-karaoke-3, #FB923C) !important;
    }
    .template-caption-shell.is-color-customized .lekha-original-template .imp-underline::after,
    .template-caption-shell.is-color-customized .lekha-original-template .w[data-imp='true'].imp-underline::after {
      background: var(--template-highlight, var(--template-secondary, #d4af37)) !important;
    }
    .template-caption-shell .lekha-original-template.t37-stage .imp-green,
    .template-caption-shell .lekha-original-template.t37-stage .w.in[data-imp='true'],
    .template-caption-shell.is-color-customized .lekha-original-template.t37-stage .imp-green,
    .template-caption-shell.is-color-customized .lekha-original-template.t37-stage .w.in[data-imp='true'] {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 transparent !important;
      text-shadow: none !important;
    }
    .template-caption-shell .lekha-original-template.t23-stage .t23-b3 .imp-bold,
    .template-caption-shell .lekha-original-template.t23-stage .t23-b3 .imp-gold,
    .template-caption-shell .lekha-original-template.t23-stage .t23-b3 .is-emphasis,
    .template-caption-shell.is-color-customized .lekha-original-template.t23-stage .t23-b3 .imp-bold,
    .template-caption-shell.is-color-customized .lekha-original-template.t23-stage .t23-b3 .imp-gold,
    .template-caption-shell.is-color-customized .lekha-original-template.t23-stage .t23-b3 .is-emphasis {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      text-shadow: 0 1px 8px rgba(0,0,0,0.55), 0 0 12px rgba(255,255,255,0.36) !important;
    }
    .template-caption-shell.has-text-gradient .lekha-original-template .lekha-applied-advanced-template,
    .template-caption-shell.has-text-gradient .lekha-original-template .lekha-template-fit,
    .template-caption-shell.has-text-gradient .lekha-original-template .w.in:not([data-imp='true']),
    .template-caption-shell.has-text-gradient .lekha-original-template .kf-base,
    .template-caption-shell.has-text-gradient .lekha-original-template .cluster-row-top,
    .template-caption-shell.has-text-gradient .lekha-original-template .cluster-row-bot,
    .template-caption-shell.has-text-gradient .lekha-original-template .blur-txt,
    .lekha-applied-basic-template-host.has-text-gradient .word,
    .lekha-applied-basic-template-host.has-text-gradient .sw-w,
    .lekha-applied-basic-template-host.has-text-gradient .lekha-basic-template-animated {
      background: var(--template-text-gradient) !important;
      background-image: var(--template-text-gradient) !important;
      -webkit-background-clip: text !important;
      background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      color: transparent !important;
    }
    .template-caption-shell.has-highlight-gradient .lekha-original-template .is-emphasis,
    .template-caption-shell.has-highlight-gradient .lekha-original-template [data-imp='true'],
    .template-caption-shell.has-highlight-gradient .lekha-original-template .w.in[data-imp='true'],
    .template-caption-shell.has-highlight-gradient .lekha-original-template [data-hero-emphasis='true'],
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-gold,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-rose,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-cyan,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-purple,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-green,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-orange,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-bold,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-italic,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-weight,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-space,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-flicker,
    .template-caption-shell.has-highlight-gradient .lekha-original-template .imp-underline,
    .lekha-applied-basic-template-host.has-highlight-gradient .word.imp,
    .lekha-applied-basic-template-host.has-highlight-gradient .word.current,
    .lekha-applied-basic-template-host.has-highlight-gradient .sw-w.imp,
    .lekha-applied-basic-template-host.has-highlight-gradient .sw-w.current {
      background: var(--template-highlight-gradient) !important;
      background-image: var(--template-highlight-gradient) !important;
      -webkit-background-clip: text !important;
      background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      color: transparent !important;
    }
    @keyframes lekhaKaraokeFill {
      from { clip-path: inset(0 100% 0 0); }
      to { clip-path: inset(0 0% 0 0); }
    }
    @keyframes lekhaTemplateWbwIn {
      to {
        opacity: 1;
        transform: none;
        clip-path: inset(0 0 0 0);
      }
    }
    @keyframes lekhaSidebarExportWordIn {
      from {
        opacity: var(--sidebar-export-initial-opacity, 0);
        transform: var(--sidebar-export-initial-transform, translateY(22px));
        clip-path: var(--sidebar-export-initial-clip, inset(0 0 0 0));
      }
      to {
        opacity: 1;
        transform: none;
        clip-path: var(--sidebar-export-final-clip, inset(0 0 0 0));
      }
    }
    @keyframes lekhaSidebarExportFlicker {
      0%, 18% { opacity: 0; }
      19%, 36% { opacity: 1; }
      37%, 54% { opacity: 0; }
      55%, 72% { opacity: 1; }
      73%, 84% { opacity: 0; }
      85%, 100% { opacity: 1; }
    }
    @keyframes lekhaSidebarExportStickyIn {
      from { opacity: 0.14; }
      to { opacity: 1; }
    }
    @keyframes source-word-rise {
      0% { transform: translateY(20px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes source-word-pan {
      0% { transform: translateX(-30px); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    @keyframes source-word-fade {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes source-word-pop {
      0% { transform: scale(0.5); opacity: 0; }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes source-word-wipe {
      0% { clip-path: inset(0 100% 0 0); }
      100% { clip-path: inset(0 0 0 0); }
    }
    @keyframes source-word-blur {
      0% { filter: blur(10px); opacity: 0; }
      100% { filter: blur(0); opacity: 1; }
    }
    @keyframes source-word-succession {
      0% { transform: translateY(-10px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes source-word-breathe {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.9; }
    }
    @keyframes source-word-baseline {
      0% { transform: translateY(5px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes source-word-drift {
      0% { transform: translate(-10px, -10px); opacity: 0; }
      100% { transform: translate(0, 0); opacity: 1; }
    }
    @keyframes source-word-tectonic {
      0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
      100% { transform: translateX(0) rotate(0); opacity: 1; }
    }
    @keyframes source-word-tumble {
      0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
      100% { transform: rotate(0) scale(1); opacity: 1; }
    }
    @keyframes caption-zoom-in { from { transform: scale(0.65); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-zoom-out { from { transform: scale(1.35); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes caption-slide-up { from { transform: translateY(34px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-slide-down { from { transform: translateY(-34px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-slide-left { from { transform: translateX(44px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes caption-slide-right { from { transform: translateX(-44px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes caption-fade-in-up { from { transform: translateY(22px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-fade-in-down { from { transform: translateY(-22px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes caption-slide-in-right { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes caption-flip-in-x { from { transform: perspective(500px) rotateX(-90deg); opacity: 0; } to { transform: perspective(500px) rotateX(0); opacity: 1; } }
    @keyframes caption-flip-in-y { from { transform: perspective(500px) rotateY(-90deg); opacity: 0; } to { transform: perspective(500px) rotateY(0); opacity: 1; } }
    @keyframes caption-blur-in { from { filter: blur(14px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
    @keyframes caption-zoom-in-fade { from { transform: scale(0.65); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-bounce-in-up { 0% { transform: translateY(32px); opacity: 0; } 60% { transform: translateY(-8px); opacity: 1; } 80% { transform: translateY(4px); } 100% { transform: translateY(0); opacity: 1; } }
    @keyframes caption-skew-left { from { transform: translateX(-30px) skewX(20deg); opacity: 0; } to { transform: translateX(0) skewX(0); opacity: 1; } }
    @keyframes caption-missile { 0% { transform: translateX(-60px) scaleX(0.6); opacity: 0; } 65% { transform: translateX(6px) scaleX(1.04); opacity: 1; } 100% { transform: translateX(0) scaleX(1); opacity: 1; } }
    @keyframes caption-shockwave { 0% { transform: scale(1.6); opacity: 0; filter: blur(6px); } 55% { transform: scale(0.94); opacity: 1; filter: blur(0); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes caption-typewriter { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
    @keyframes caption-slam-down { 0% { transform: translateY(-55px) scaleY(1.2); opacity: 0; } 65% { transform: translateY(6px) scaleY(0.94); opacity: 1; } 100% { transform: translateY(0) scaleY(1); opacity: 1; } }
    @keyframes caption-fire-charge { 0% { transform: translateY(18px) scaleX(0.8); opacity: 0; filter: blur(5px); } 70% { transform: translateY(-4px) scaleX(1.02); opacity: 1; filter: blur(0); } 100% { transform: translateY(0) scaleX(1); opacity: 1; } }
    @keyframes caption-stampede { 0% { transform: translateX(-55px) scaleX(1.1); opacity: 0; } 70% { transform: translateX(5px) scaleX(0.98); opacity: 1; } 100% { transform: translateX(0) scaleX(1); opacity: 1; } }
    @keyframes caption-recoil { 0% { transform: translateX(0); } 20% { transform: translateX(-10px); } 60% { transform: translateX(4px); } 100% { transform: translateX(0); } }
    @keyframes caption-iris-open { from { clip-path: circle(0 at 50% 50%); opacity: 0.4; } to { clip-path: circle(150% at 50% 50%); opacity: 1; } }
    @keyframes caption-parallax-rise { from { transform: translateY(14px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes caption-golden-ratio { from { transform: scaleX(0.618) translateX(-20px); opacity: 0; } to { transform: scaleX(1) translateX(0); opacity: 1; } }
    @keyframes caption-curtain-split { from { clip-path: inset(0 50%); opacity: 0.5; } to { clip-path: inset(0); opacity: 1; } }
    @keyframes caption-prestige { from { transform: scale(1.1); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-fade-through-black { 0% { opacity: 1; } 35%, 65% { opacity: 0; } 100% { opacity: 1; } }
    @keyframes caption-depth-pull { from { transform: scale(0.35); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes caption-slow-burn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes caption-diagonal-wipe { from { clip-path: inset(0 100% 100% 0); } to { clip-path: inset(0); } }
    @keyframes caption-confetti-pop { 0% { transform: scale(0.3) rotate(-12deg); opacity: 0; } 55% { transform: scale(1.15) rotate(3deg); opacity: 1; } 75% { transform: scale(0.95) rotate(-1deg); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes caption-sticker-slap { 0% { transform: scale(1.45) rotate(-6deg); opacity: 0; } 45% { transform: scale(0.94) rotate(1deg); opacity: 1; } 75% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes caption-wobble-entry { 0% { transform: translateX(-22px) rotate(-4deg); opacity: 0; } 35% { transform: translateX(9px) rotate(2deg); opacity: 1; } 65% { transform: translateX(-4px) rotate(-1deg); } 100% { transform: translateX(0); opacity: 1; } }
    @keyframes caption-balloon-float { 0% { transform: translateY(22px) scale(0.8); opacity: 0; } 65% { transform: translateY(-6px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes caption-color-splash { 0% { transform: scale(0.85); opacity: 0; filter: saturate(3) brightness(1.6); } 50% { transform: scale(1.06); opacity: 1; filter: saturate(2) brightness(1.3); } 100% { transform: scale(1); opacity: 1; filter: saturate(1) brightness(1); } }
  `;

  const viewport = {
    width: payload.video_width,
    height: payload.video_height,
    deviceScaleFactor: 1,
  };
  let browser = await connectWarmBrowser(puppeteer);
  let isolatedContext = null;
  if (browser) {
    try {
      isolatedContext = await browser.createBrowserContext();
    } catch {
      browser.disconnect();
      if (process.env.RENDER_BROWSER_REQUIRE_WARM === '1') {
        throw new Error('Required warm render browser cannot create an isolated context');
      }
      browser = null;
    }
  }
  if (!browser) browser = await puppeteer.launch(browserLaunchOptions(viewport));

  try {
    const page = isolatedContext ? await isolatedContext.newPage() : await browser.newPage();
    await page.setViewport(viewport);
    // Font stylesheets can take longer than Puppeteer's 30-second default on
    // cold CI runners. Keep the wait bounded, but leave enough room for the
    // same assets the export subsequently verifies via document.fonts.ready.
    page.setDefaultNavigationTimeout(60_000);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const rawUrl = request.url();
      if (rawUrl === 'about:blank' || rawUrl.startsWith('data:')) {
        request.continue();
        return;
      }
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'https:' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(parsed.hostname)) {
          request.continue();
          return;
        }
      } catch {
        // Invalid and non-network URLs are blocked below.
      }
      request.abort('blockedbyclient');
    });
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error?.stack || error?.message || String(error));
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text());
      }
    });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; img-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          ${exportFontLinks}
          <style>${bundledRenderFontCss}\n${runtimeCss}</style>
        </head>
        <body>
          <div id="overlay-root"></div>
          <script>window.__exportCanvasScale = ${JSON.stringify(exportCssScale)};</script>
          <script>window.__exportScriptFontMaps = ${JSON.stringify(exportScriptFontMaps)};</script>
          <script>window.__basicTemplateMarkupMap = ${JSON.stringify(basicTemplateMarkupMap)};</script>
          ${basicTemplateInlineSource ? `<script>${basicTemplateInlineSource}</script>` : ''}
          <script>${templateTextRulesSource}</script>
          <script>${buildRuntimeScript(advancedTemplateBlockMarkup)}</script>
        </body>
      </html>
    `, { waitUntil: 'networkidle0' });

    await page.addStyleTag({ content: captionCss });
    await page.addStyleTag({ content: advancedCaptionCss });
    await page.addStyleTag({ content: originalTemplateCss });
    if (hasBasicTemplate) {
      await page.addStyleTag({ content: APPLIED_BASIC_TEMPLATE_HOST_OVERRIDES });
    }
    const renderPayloadType = await page.evaluate(() => typeof window.__renderPayload);
    if (renderPayloadType !== 'function') {
      throw new Error(`[Template DOM] overlay runtime did not initialize __renderPayload. Page errors: ${pageErrors.join(' | ') || 'none'}`);
    }
    await page.evaluate(() => document.fonts.ready);

    const segments = [];
    const points = new Set([0, Number(payload.duration || 0)]);
    const templateId = String(payload.style?.template_id || '').trim();
    const sidebarTemplateId = String(payload.style?.template_20_id || '').trim();
      const templateUsesPreviewTiming = isAdvancedTemplateId(templateId);
      const templateUsesSidebarTiming = Boolean(sidebarTemplateId);
      const templateUsesBasicTiming = SOURCE_BASIC_TEMPLATE_IDS.includes(templateId);
    const defaultTemplateSampleFps = Math.max(24, Math.min(60, Number(payload.style?.fps || 30)));
    const nonTextCaptions = (payload.captions || []).filter((caption) => !caption?.is_text_element);
    const adaptiveTemplateSampleFps = defaultTemplateSampleFps;

    for (const caption of payload.captions || []) {
      const start = Number(caption.start_time ?? 0);
      const end = Number(caption.end_time ?? start);
      points.add(start);
      points.add(end);
      const lineAnimation = LINE_ANIMATION_DEFS[String(caption.animation || '')];
      const animatedWordStyles = Object.values(caption.word_styles || {})
        .filter((wordStyle) => wordStyle && LINE_ANIMATION_DEFS[String(wordStyle.animation || '')]);
      if (lineAnimation || animatedWordStyles.length) {
        const lineSpeed = Math.max(0.1, Number(caption.animation_speed || 1));
        const lineWindowSeconds = lineAnimation
          ? (lineAnimation[3] === 'infinite'
              ? Math.max(0, end - start)
              : Math.min(Math.max(0, end - start), (lineAnimation[1] / lineSpeed) / 1000))
          : 0;
        const wordWindowSeconds = animatedWordStyles.reduce((maxWindow, wordStyle) => {
          const definition = LINE_ANIMATION_DEFS[String(wordStyle.animation || '')];
          const speed = Math.max(0.1, Number(wordStyle.animationSpeed || 1));
          const windowSeconds = definition[3] === 'infinite'
            ? Math.max(0, end - start)
            : (definition[1] / speed) / 1000;
          return Math.max(maxWindow, windowSeconds);
        }, 0);
        const animationEnd = Math.min(end, start + Math.max(lineWindowSeconds, wordWindowSeconds));
        for (
          let sample = start + (1 / defaultTemplateSampleFps);
          sample < animationEnd;
          sample += (1 / defaultTemplateSampleFps)
        ) {
          points.add(sample);
        }
      }
      if (templateUsesPreviewTiming) {
        if (caption?.is_text_element) continue;
        const fallbackIndex = nonTextCaptions.findIndex((item) => item?.id === caption?.id);
        const storedPhaseIndex = Number(caption.template_phase_index);
        const templateIndex = Number.isFinite(storedPhaseIndex)
          ? storedPhaseIndex
          : Number.isFinite(Number(caption.__templateIndex))
            ? Number(caption.__templateIndex)
            : Math.max(0, fallbackIndex);
        const blockType = getTemplateBlockType(templateId, templateIndex);
        const splitWords = String(caption.text || '').split(/\s+/).filter(Boolean);
        const wordCount = Math.max(splitWords.length, 1);
        if (blockType.startsWith('wbw')) {
          const segmentDuration = Math.max(end - start, 0) / wordCount;
          for (let index = 1; index < wordCount; index += 1) {
            points.add(start + (segmentDuration * index));
          }
        }
        // Keyframe templates (T41–T52) seek authored CSS keyframes; sample their
        // whole authored schedule (or the whole caption for looping phases).
        const animationWindow = getAdvancedTemplateAnimationWindow(blockType, Math.max(end - start, 0), wordCount, templateId);
        const animationEnd = Math.min(end, start + animationWindow);
        for (
          let sample = start + (1 / adaptiveTemplateSampleFps);
          sample < animationEnd;
          sample += (1 / adaptiveTemplateSampleFps)
        ) {
            points.add(sample);
        }
      } else if (templateUsesSidebarTiming) {
        if (caption?.is_text_element) continue;
        const sidebarSampleFps = defaultTemplateSampleFps;
        const wordCount = Math.max(1, String(caption.text || '').trim().split(/\s+/).filter(Boolean).length);
        const captionTemplateSource = String(caption.template_source || caption.applied_template_style?.template_source || payload.style?.template_source || '').trim();
        const isLcSidebarCaption = captionTemplateSource === 'lekha-lc';
        const durationSeconds = Math.max(0, end - start);
        // Nominal LC schedule from the shared timing constants. Only a fallback
        // for scenes with no authored motion nodes now — see lcAuthoredCeilingMs.
        const lcSchedule = isLcSidebarCaption
          ? getLcMotionSchedule(Array.from({ length: wordCount }, (_, index) => ({
            animation: 'rise',
            duration: LC_TEMPLATE_TIMING.heroDurationMs,
            delay: index * LC_TEMPLATE_TIMING.staggerMs,
          })))
          : null;
        // The frame sampled for a segment is held for that whole segment, so the
        // sampling window must extend past the LAST word reveal — otherwise the
        // frame shown for the caption's tail predates the final word and that
        // word never appears in the exported video.
        //
        // Deriving the window from LC_TEMPLATE_TIMING.staggerMs is a guess, and
        // it is not a conservative one: authored LC scenes use their own stagger
        // (T167 phase 3 staggers 560ms, twice the assumed 280ms), so the window
        // closed 250ms before that scene's last reveal. Use the authored
        // data-lc-* timings instead, bounded by the ceiling that
        // fitLcMotionScheduleToCaption itself enforces — together those give the
        // exact motion end rather than an estimate in either direction.
        const lcAuthoredCeilingMs = (() => {
          if (!isLcSidebarCaption) return 0;
          const markup = String(
            caption.template_markup
            || caption.applied_template_style?.template_markup
            || payload.style?.template_markup
            || '',
          );
          const readMax = (pattern) => {
            let max = 0;
            for (const match of markup.matchAll(pattern)) {
              const value = Number(match[1]);
              if (Number.isFinite(value) && value > max) max = value;
            }
            return max;
          };
          const maxDelayMs = readMax(/data-lc-delay="(\d+(?:\.\d+)?)"/g);
          const maxDurationMs = readMax(/data-lc-duration="(\d+(?:\.\d+)?)"/g);
          // No authored motion nodes (plain/block scenes) — keep the nominal one.
          if (!maxDelayMs && !maxDurationMs) return lcSchedule.endMs;
          // Card-wide maxima, so this can only over-reach a given phase, never
          // fall short of it; the fit ceiling below trims any over-reach.
          return maxDelayMs + (maxDurationMs || LC_TEMPLATE_TIMING.heroDurationMs);
        })();
        // Mirrors fitLcMotionScheduleToCaption: no LC motion can run past this.
        const lcFitCeilingMs = Math.max(
          0,
          (durationSeconds * 1000) - Math.min(180, Math.max(60, durationSeconds * 1000 * 0.12)),
        );
        const animationWindowSeconds = Math.min(
          durationSeconds,
          isLcSidebarCaption
            ? ((Math.min(lcFitCeilingMs, lcAuthoredCeilingMs) + 140) / 1000)
            : 0.54 + (Math.max(0, wordCount - 1) * SIDEBAR_TEMPLATE_WORD_STAGGER_SECONDS) + 0.42,
        );
        const animationEnd = Math.min(end, start + animationWindowSeconds);
        points.add(start);
        points.add(animationEnd);
        points.add(end);
        for (
          let sample = start + (1 / sidebarSampleFps);
          sample < animationEnd;
          sample += (1 / sidebarSampleFps)
        ) {
          points.add(sample);
        }
      } else if (templateUsesBasicTiming) {
        if (caption?.is_text_element) continue;
        const splitWords = String(caption.text || '').split(/\s+/).filter(Boolean);
        const wordCount = Math.max(1, splitWords.length);
        for (const word of caption.words || []) {
          const wordStart = Number(word?.start ?? start);
          const wordEnd = Number(word?.end ?? wordStart);
          if (Number.isFinite(wordStart)) points.add(wordStart);
          if (Number.isFinite(wordEnd)) points.add(wordEnd);
        }
        const delaySeconds = templateId === 't-WS1' || templateId === 't-T4' ? 0.055 : 0.065;
        const durationSeconds = templateId === 't-WS1' || templateId === 't-T4' ? 0.32 : 0.28;
        const animationWindowSeconds = Math.min(
          Math.max(0, end - start),
          0.09 + (Math.max(0, wordCount - 1) * delaySeconds) + durationSeconds,
        );
        const animationEnd = Math.min(end, start + animationWindowSeconds);
        for (
          let sample = start + (1 / defaultTemplateSampleFps);
          sample < animationEnd;
          sample += (1 / defaultTemplateSampleFps)
        ) {
          points.add(sample);
        }
      } else {
        for (const word of caption.words || []) {
          const wordStart = Number(word?.start ?? start);
          const wordEnd = Number(word?.end ?? wordStart);
          if (Number.isFinite(wordStart)) points.add(wordStart);
          if (Number.isFinite(wordEnd)) points.add(wordEnd);
        }
      }
      // CPTs and the explicit word-by-word delivery mode (whole video, or this
      // caption's reveal_mode) change visibility at word boundaries, so the
      // compositor needs a segment for every step.
      const revealsWordByWord = (
        captionHasCptWordStyles(caption)
        || payload.style?.show_inactive === false
        || caption?.reveal_mode === 'word'
      );
      if (revealsWordByWord && !caption?.is_text_element) {
        const revealWordCount = Math.max(
          1,
          String(caption.text || '').trim().split(/\s+/).filter(Boolean).length,
        );
        getCaptionWordRevealTimes(caption, revealWordCount).forEach((wordStart, index) => {
          if (index > 0 && Number.isFinite(wordStart)) points.add(wordStart);
        });
      }
    }

    const sorted = [...points]
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((left, right) => left - right);

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const start = sorted[index];
      const end = sorted[index + 1];
      const duration = end - start;
      if (duration <= 0.01) continue;
      segments.push({ start, end, duration });
    }

    if (segments.length === 0) {
      segments.push({ start: 0, end: Math.max(Number(payload.duration || 1), 1), duration: Math.max(Number(payload.duration || 1), 1) });
    }

    const maxOverlayFrames = Math.max(
      300,
      Math.min(6000, Number(process.env.TEMPLATE_OVERLAY_MAX_FRAMES || 3600)),
    );
    if (segments.length > maxOverlayFrames) {
      const groupSize = Math.ceil(segments.length / maxOverlayFrames);
      const compacted = [];
      for (let index = 0; index < segments.length; index += groupSize) {
        const group = segments.slice(index, index + groupSize);
        const start = group[0].start;
        const end = group[group.length - 1].end;
        compacted.push({ start, end, duration: end - start });
      }
      console.warn(`[Template DOM] frame cap compacted ${segments.length} samples to ${compacted.length}`);
      segments.splice(0, segments.length, ...compacted);
    }

    console.log(`[Template DOM] segments=${segments.length} template_timing=${templateUsesPreviewTiming} sidebar_timing=${templateUsesSidebarTiming} sample_fps=${adaptiveTemplateSampleFps}`);

    const frameLines = [];
    const frameFiles = [];
    const completenessAudits = [];
    const wordPositionAudits = [];
    const lastIndex = segments.length - 1;
    const blankFramePath = path.join(outputDir, 'frame-blank.png');

    await page.evaluate(() => {
      const root = document.getElementById('overlay-root');
      if (root) root.innerHTML = '';
    });
    await page.screenshot({
      path: blankFramePath,
      omitBackground: true,
      // Caption exports favor throughput over PNG compression ratio. Chromium's
      // fast encoder preserves the rendered pixels while avoiding expensive
      // per-frame compression work; the temporary files are removed after the
      // final video is encoded.
      optimizeForSpeed: true,
    });

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const sampleOffset = Math.min(
        Math.max(0, segment.duration / 2),
        1 / (adaptiveTemplateSampleFps * 2),
      );
      const renderTime = Math.min(segment.end - 0.0005, segment.start + sampleOffset);
      const framePath = path.join(outputDir, `frame-${String(index).padStart(5, '0')}.png`);
      const hasActiveCaptions = (payload.captions || []).some((caption) => {
        const start = Number(caption.start_time ?? 0);
        const end = Number(caption.end_time ?? start);
        return renderTime >= start && renderTime < end;
      });

      let renderedFramePath = blankFramePath;
      if (hasActiveCaptions) {
        await page.evaluate(async (currentPayload, currentTime) => {
          try {
            window.__renderPayload(currentPayload, currentTime);
            // Fonts are requested lazily when caption glyphs enter the DOM.
            // The empty-page fonts.ready above cannot settle their geometry.
            // Rebuild measured word offsets after a newly used font arrives.
            void document.getElementById('overlay-root').offsetWidth;
            if (document.fonts.status === 'loading') {
              let fontTimeout;
              try {
                await Promise.race([
                  document.fonts.ready,
                  new Promise((_, reject) => {
                    fontTimeout = setTimeout(() => reject(new Error('Caption fonts did not settle within 15 seconds')), 15000);
                  }),
                ]);
              } finally {
                clearTimeout(fontTimeout);
              }
              window.__renderPayload(currentPayload, currentTime);
            }
            if (window.__activateTemplateAnimations) {
              await window.__activateTemplateAnimations();
            } else {
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
          } catch (error) {
            throw new Error(`[Template DOM] renderPayload failed at ${currentTime.toFixed(3)}s: ${error?.stack || error?.message || error}`);
          }

          let animations = [];
          try {
            animations = document.getAnimations({ subtree: true });
          } catch (error) {
            throw new Error(`[Template DOM] getAnimations failed at ${currentTime.toFixed(3)}s: ${error?.stack || error?.message || error}`);
          }
          animations.forEach((animation) => {
            try {
              const target = animation.effect?.target?.element || animation.effect?.target;
              const shell = target?.closest?.(
                '.caption-line-animation-shell, .template-caption-shell, .lekha-sidebar-export-template-shell, .lekha-applied-basic-template-host',
              );
              const captionStart = Number(shell?.dataset?.captionStart || 0);
              const captionEnd = Number(shell?.dataset?.captionEnd || captionStart);
              const captionElapsedMs = Math.max(0, (currentTime - captionStart) * 1000);
              const block = target?.closest?.('.lekha-applied-advanced-template');
              const blockType = block?.dataset?.templateBlockType || 'styled';
              const wordCount = block
                ? Math.max(
                    1,
                    block.querySelectorAll('.w, .kf-word').length
                      || String(block.textContent || '').trim().split(/\s+/).filter(Boolean).length,
                  )
                : 1;
              const animationElapsedMs = block && window.__getAdvancedPlaybackElapsedMs
                ? window.__getAdvancedPlaybackElapsedMs(
                    blockType,
                    wordCount,
                    Math.max(0, (captionEnd - captionStart) * 1000),
                    captionElapsedMs,
                  )
                : captionElapsedMs;
              animation.pause();
              animation.currentTime = animationElapsedMs;
            } catch {
              // Some browser-managed animations cannot be seeked; leave them at their rendered state.
            }
          });
          // LC accent colors are opaque hex values, but entrance keyframes such
          // as fade/rise/pop interpolate `opacity`. When a frame lands inside
          // that interpolation, the keyword has the right color but is composited
          // at partial alpha and looks washed out compared with the template and
          // canvas previews. Promote only highlights that have actually started
          // appearing; opacity:0 nodes remain hidden until their authored delay.
          // Walk animated wrappers too, because LC4/LC5 can fade a whole line.
          const lcHighlightSelector = [
            '.hero',
            '.is-emphasis',
            '.ns3hero',
            '.ns3box',
            '.ns3mark',
            '.ns3bracket',
            '.ns3dot',
            '[data-hero-emphasis="true"]',
            '.box',
          ].join(', ');
          document.querySelectorAll(
            '.lekha-sidebar-export-template-shell[data-template-source="lekha-lc"] .sb.active',
          ).forEach((block) => {
            block.querySelectorAll(lcHighlightSelector).forEach((highlight) => {
              const visibleOpacity = Number.parseFloat(getComputedStyle(highlight).opacity);
              if (!Number.isFinite(visibleOpacity) || visibleOpacity <= 0.001) return;
              let node = highlight;
              while (node && node !== block) {
                const opacity = Number.parseFloat(getComputedStyle(node).opacity);
                if (Number.isFinite(opacity) && opacity > 0.001 && opacity < 1) {
                  node.style.setProperty('opacity', '1', 'important');
                }
                node = node.parentElement;
              }
            });
          });
          document.querySelectorAll('.lekha-applied-advanced-template.active').forEach((block) => {
            if (block.closest('[data-caption-cpt="true"]')) return;
            block.style.transition = 'none';
            block.style.opacity = '1';
            block.style.visibility = 'visible';

            const shell = block.closest('.template-caption-shell');
            const captionStart = Number(shell?.dataset?.captionStart || 0);
            const captionEnd = Number(shell?.dataset?.captionEnd || captionStart);
            const captionElapsedMs = Math.max(0, (currentTime - captionStart) * 1000);
            const keyframeTemplateId = Array.from(window.__keyframeAdvancedTemplateIds || [])
              .find((id) => block.classList.contains(id + '-block'));
            if (keyframeTemplateId && window.__seekKeyframeTemplateAnimations) {
              // T41–T52: seek the authored CSS keyframes relative to this caption,
              // exactly like the editor canvas does while playing.
              window.__seekKeyframeTemplateAnimations(block, {
                elapsedMs: captionElapsedMs,
                captionDurationMs: Math.max(0, (captionEnd - captionStart) * 1000),
                settled: false,
              });
              return;
            }
            const blockType = block.dataset.templateBlockType || 'styled';
            const timing = window.__advancedTemplateTiming || {};
            const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
            const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
            const setImportant = (element, property, value) => {
              element?.style?.setProperty?.(property, value, 'important');
            };
            const wordCount = Math.max(
              1,
              block.querySelectorAll('.w, .kf-word').length
                || String(block.textContent || '').trim().split(/\s+/).filter(Boolean).length,
            );
            const animationElapsedMs = window.__getAdvancedPlaybackElapsedMs
              ? window.__getAdvancedPlaybackElapsedMs(
                  blockType,
                  wordCount,
                  Math.max(0, (captionEnd - captionStart) * 1000),
                  captionElapsedMs,
                )
              : captionElapsedMs;

            if (blockType === 'karaoke') {
              const words = Array.from(block.querySelectorAll('.kf-word'));
              const perWord = Number(timing.holdMs || 1650) / Math.max(1, words.length + 0.5);
              words.forEach((word, index) => {
                const fill = word.querySelector('.kf-fill');
                if (!fill) return;
                const progress = clamp((animationElapsedMs - (index * perWord)) / perWord);
                fill.style.animation = 'none';
                fill.style.transition = 'none';
                fill.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
              });
              return;
            }

            if (blockType === 'styled') {
              const styledDurationMs = block.classList.contains('t25-b0')
                ? 700
                : block.classList.contains('t25-b1')
                  ? 500
                  : Number(timing.styledDurationMs || 850);
              const progress = clamp(animationElapsedMs / Math.max(1, styledDurationMs));
              const eased = easeOut(progress);
              block.querySelectorAll('.hand-txt').forEach((element) => {
                setImportant(element, 'animation', 'none');
                setImportant(element, 'transition', 'none');
                setImportant(element, 'opacity', String(progress));
                setImportant(element, 'transform', `translateX(${12 * (1 - eased)}px) rotate(${0.5 * (1 - eased)}deg)`);
                setImportant(element, 'filter', `blur(${2 * (1 - eased)}px)`);
              });
              block.querySelectorAll('.soft-rise').forEach((element) => {
                setImportant(element, 'animation', 'none');
                setImportant(element, 'transition', 'none');
                setImportant(element, 'opacity', String(progress));
                setImportant(element, 'transform', `translateY(${8 * (1 - eased)}px)`);
                setImportant(element, 'filter', 'none');
              });
              return;
            }

            if (!blockType.startsWith('wbw-')) return;
            const sequential = blockType === 'wbw-seq'
              || blockType === 'wbw-seq-fade'
              || blockType === 'wbw-seq-flip';
            block.querySelectorAll('.w').forEach((word, fallbackIndex) => {
              const parsedIndex = Number(word.dataset.i);
              const index = Number.isFinite(parsedIndex) ? parsedIndex : fallbackIndex;
              const isImp = word.dataset.imp === 'true';
              const impClass = word.dataset.impCls || '';
              const wordBlockType = word.dataset.lineMotion || blockType;
              const isEvidenceEmphasis = wordBlockType === 't39-evidence' && isImp;
              const lineDelayMs = Number(word.dataset.lineDelay || 0);
              const battleMotion = word.dataset.battleMotion || '';
              const battleIndex = Number.isFinite(Number(word.dataset.battleIndex))
                ? Number(word.dataset.battleIndex)
                : index;
              const delayMs = sequential
                ? index * Number(timing.sequentialStaggerMs || 145)
                : battleMotion
                  ? (battleIndex * 58) + lineDelayMs + (isImp ? 24 : 0)
                  : (index * Number(timing.wordStaggerMs || 45))
                  + (isImp ? Number(timing.emphasisDelayMs || 60) : 0)
                  + lineDelayMs;
              const durationMs = isEvidenceEmphasis
                ? 360
                : sequential
                ? Number(timing.sequentialDurationMs || 180)
                : battleMotion
                  ? (isImp ? 380 : 320)
                  : isImp
                  ? Number(timing.emphasisDurationMs || 300)
                  : Number(timing.wordDurationMs || 210);
              const progress = clamp((animationElapsedMs - delayMs) / durationMs);
              const eased = 1 - Math.pow(1 - progress, 3);
              setImportant(word, 'animation', 'none');
              setImportant(word, 'transition', 'none');
              setImportant(word, 'opacity', String(progress));
              setImportant(word, 'clip-path', 'none');
              setImportant(word, 'transform-origin', 'initial');
              setImportant(word, 'filter', 'none');
              setImportant(word, 'text-shadow', 'none');

              if (battleMotion === 'sweep-left') {
                setImportant(word, 'transform', `translateX(${-34 * (1 - eased)}px)`);
              } else if (battleMotion === 'lift-up') {
                setImportant(word, 'transform', `translateY(${28 * (1 - eased)}px)`);
              } else if (isEvidenceEmphasis) {
                setImportant(word, 'transform', `translateY(${18 * (1 - eased)}px) scale(${0.72 + (0.28 * eased)}) rotate(${-2 * (1 - eased)}deg)`);
                setImportant(word, 'text-shadow', `0 0 ${4 + (10 * eased)}px currentColor`);
              } else if (sequential) {
                if (blockType === 'wbw-seq-fade') {
                  setImportant(word, 'transform', 'none');
                } else if (blockType === 'wbw-seq-flip') {
                  setImportant(word, 'transform', `perspective(320px) rotateX(${-90 * (1 - eased)}deg)`);
                  setImportant(word, 'transform-origin', 'center bottom');
                } else {
                  setImportant(word, 'transform', `scale(${0.82 + (0.18 * eased)})`);
                }
              } else if (wordBlockType === 't16-stack') {
                setImportant(word, 'transform', `translateY(${24 * (1 - eased)}px) scale(${0.92 + (0.08 * eased)})`);
                setImportant(word, 'filter', `blur(${4 * (1 - eased)}px)`);
              } else if (wordBlockType === 't16-neon') {
                setImportant(word, 'transform', `scale(${0.86 + (0.14 * eased)})`);
                setImportant(word, 'filter', `brightness(${0.75 + (0.25 * eased)})`);
                setImportant(word, 'text-shadow', `0 0 ${4 + (12 * eased)}px rgba(0,229,255,${0.25 + (0.35 * eased)})`);
              } else if (wordBlockType === 't16-diagonal') {
                setImportant(word, 'transform', `translate(${28 * (1 - eased)}px, ${-20 * (1 - eased)}px) rotate(${-4 * (1 - eased)}deg)`);
              } else if (wordBlockType === 't16-impact') {
                setImportant(word, 'transform', `translateX(${-36 * (1 - eased)}px) scale(${1 + (0.1 * (1 - eased))})`);
              } else if (wordBlockType === 't24-wipe') {
                setImportant(word, 'opacity', '1');
                setImportant(word, 'transform', `translateY(${10 * (1 - eased)}px)`);
                setImportant(word, 'clip-path', `inset(${(1 - eased) * 100}% 0 0 0)`);
              } else if (wordBlockType === 't24-drift') {
                setImportant(word, 'transform', `translate(${6 * (1 - eased)}px, ${10 * (1 - eased)}px) rotate(${1 * (1 - eased)}deg)`);
                setImportant(word, 'filter', `blur(${2 * (1 - eased)}px)`);
              } else if (wordBlockType === 't24-slide') {
                setImportant(word, 'transform', `translateX(${-14 * (1 - eased)}px)`);
              } else if (wordBlockType === 't24-stamp') {
                setImportant(word, 'transform', `scale(${1.08 - (0.08 * eased)})`);
                setImportant(word, 'text-shadow', `0 0 ${7 * eased}px rgba(249,115,22,${0.2 + (0.18 * eased)})`);
              } else if (wordBlockType === 't24-inner') {
                setImportant(word, 'transform', `translateY(${8 * (1 - eased)}px) scale(${0.94 + (0.06 * eased)})`);
                setImportant(word, 'filter', `blur(${2 * (1 - eased)}px)`);
              } else if (wordBlockType === 't26-shutter') {
                setImportant(word, 'opacity', progress > 0.08 ? '1' : '0');
                setImportant(word, 'transform', `translateY(${18 * (1 - eased)}px) skewX(${-8 * (1 - eased)}deg)`);
                setImportant(word, 'clip-path', `inset(0 0 ${(1 - eased) * 100}% 0)`);
              } else if (wordBlockType === 't26-snap') {
                setImportant(word, 'transform', `translateX(${-32 * (1 - eased)}px) rotate(${-3 * (1 - eased)}deg)`);
              } else if (wordBlockType === 't26-kick') {
                setImportant(word, 'transform', `translate(${18 * (1 - eased)}px, ${-16 * (1 - eased)}px) scale(${1 + (0.08 * (1 - eased))})`);
              } else if (wordBlockType === 't26-tag') {
                setImportant(word, 'transform', `scale(${0.82 + (0.18 * eased)})`);
                setImportant(word, 'filter', `contrast(${0.75 + (0.25 * eased)})`);
              } else if (wordBlockType === 't29-shutter') {
                setImportant(word, 'opacity', progress > 0.12 ? '1' : '0');
                setImportant(word, 'transform', `scaleX(${0.72 + (0.28 * eased)}) translateY(${14 * (1 - eased)}px)`);
                setImportant(word, 'clip-path', `inset(0 ${(1 - eased) * 48}% 0 ${(1 - eased) * 48}%)`);
              } else if (wordBlockType === 't29-recoil') {
                setImportant(word, 'transform', `translateY(${-22 * (1 - eased)}px) scale(${1.14 - (0.14 * eased)})`);
              } else if (wordBlockType === 't29-charge') {
                setImportant(word, 'transform', `translate(${36 * (1 - eased)}px, ${-10 * (1 - eased)}px) skewX(${-10 * (1 - eased)}deg)`);
              } else if (wordBlockType === 't29-clamp') {
                setImportant(word, 'transform', `scaleY(${0.72 + (0.28 * eased)})`);
                setImportant(word, 'clip-path', `inset(${(1 - eased) * 42}% 0 ${(1 - eased) * 42}% 0)`);
              } else if (isImp) {
                const entrance = window.__advancedImpEntrances?.[impClass] || 'opposite';
                const effect = entrance === 'opposite'
                  ? (wordBlockType === 'wbw-rise' ? 'opposite-slide' : 'opposite-rise')
                  : entrance;
                if (effect === 'wipe') {
                  setImportant(word, 'opacity', '1');
                  setImportant(word, 'transform', 'none');
                  setImportant(word, 'clip-path', `inset(0 ${(1 - eased) * 100}% 0 0)`);
                } else if (effect === 'wipe-up') {
                  setImportant(word, 'opacity', '1');
                  setImportant(word, 'transform', 'none');
                  setImportant(word, 'clip-path', impClass === 'imp-underline'
                    ? 'inset(0 0 0 0)'
                    : `inset(${(1 - eased) * 100}% 0 0 0)`);
                } else if (effect === 'roll') {
                  setImportant(word, 'transform', `rotateX(${-90 * (1 - eased)}deg)`);
                  setImportant(word, 'transform-origin', 'center bottom');
                } else if (effect === 'opposite-slide') {
                  setImportant(word, 'transform', `translateX(${-28 * (1 - eased)}px)`);
                } else {
                  setImportant(word, 'transform', `translateY(${28 * (1 - eased)}px)`);
                }
              } else if (wordBlockType === 'wbw-slide') {
                setImportant(word, 'transform', `translateX(${-16 * (1 - eased)}px)`);
              } else {
                setImportant(word, 'transform', `translateY(${20 * (1 - eased)}px)`);
              }
              word.classList.toggle('in', progress > 0);
              word.classList.toggle('fx', progress >= 1 && impClass === 'imp-flicker');
            });
          });
          // All animation clocks above are paused and explicitly seeked. A
          // forced layout makes those styles capture-ready without waiting for
          // a real-time animation frame for every exported overlay image.
          void document.getElementById('overlay-root')?.offsetHeight;
        }, payload, renderTime);

        if (shouldAuditWordPositions) {
          const frameWordPositions = await page.evaluate((currentPayload, currentTime) => {
            const root = document.getElementById('overlay-root');
            const rootRect = root?.getBoundingClientRect();
            if (!rootRect?.width || !rootRect?.height) return [];

            const nodesByKey = new Map();
            root.querySelectorAll('[data-word-key]').forEach((node) => {
              const key = node.getAttribute('data-word-key');
              if (!key) return;
              const isActiveTemplateWord = Boolean(node.closest(
                '.sb.active, .sblock.active, .lekha-applied-advanced-template.active',
              ));
              if (!nodesByKey.has(key) || isActiveTemplateWord) nodesByKey.set(key, node);
            });
            const activeCaptions = (currentPayload.captions || []).filter((caption) => {
              const start = Number(caption.start_time ?? 0);
              const end = Number(caption.end_time ?? start);
              return currentTime >= start && currentTime < end;
            });

            return activeCaptions.flatMap((caption) => Object.entries(caption.word_styles || {})
              .filter(([, wordStyle]) => {
                const hasAbsolutePosition = (
                  Number.isFinite(Number(wordStyle?.abs_x_pct))
                  && Number.isFinite(Number(wordStyle?.abs_y_pct))
                  && (
                    Math.abs(Number(wordStyle.abs_x_pct)) > 0.01
                    || Math.abs(Number(wordStyle.abs_y_pct)) > 0.01
                  )
                );
                const hasRelativeOffset = (
                  Math.abs(Number(wordStyle?.x || 0)) > 0.01
                  || Math.abs(Number(wordStyle?.y || 0)) > 0.01
                );
                return hasAbsolutePosition || hasRelativeOffset;
              })
              .map(([key, wordStyle]) => {
                const node = nodesByKey.get(key);
                if (!node) {
                  return { key, found: false };
                }
                const markedTargets = [
                  ...(node.matches('[data-export-word-position-target="true"]') ? [node] : []),
                  ...node.querySelectorAll('[data-export-word-position-target="true"]'),
                ];
                const rects = (markedTargets.length ? markedTargets : [node])
                  .map((target) => target.getBoundingClientRect())
                  .filter((rect) => rect.width > 0 && rect.height > 0);
                if (!rects.length) {
                  return { key, found: true, visible: false };
                }
                const left = Math.min(...rects.map((rect) => rect.left));
                const top = Math.min(...rects.map((rect) => rect.top));
                const right = Math.max(...rects.map((rect) => rect.right));
                const bottom = Math.max(...rects.map((rect) => rect.bottom));
                const hasAbsolutePosition = (
                  Number.isFinite(Number(wordStyle.abs_x_pct))
                  && Number.isFinite(Number(wordStyle.abs_y_pct))
                  && (
                    Math.abs(Number(wordStyle.abs_x_pct)) > 0.01
                    || Math.abs(Number(wordStyle.abs_y_pct)) > 0.01
                  )
                );
                // A `translate` that is merely *set* proves nothing: CSS
                // transforms are ignored on non-replaced inline boxes, so a
                // dragged word can carry the right value and still never move.
                // Measure the offset the browser actually honours by dropping
                // the translate, re-measuring, and restoring it.
                const positionTarget = markedTargets[0] || node;
                const motionTarget = node.querySelector('[data-cpt-word-motion="true"]') || positionTarget;
                const targetDisplay = getComputedStyle(positionTarget).display;
                const measureCenter = (element) => {
                  const box = element.getBoundingClientRect();
                  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
                };
                const translatedCenter = measureCenter(positionTarget);
                const clippingAncestors = [];
                let clippingNode = positionTarget.parentElement;
                while (clippingNode && clippingNode !== root.parentElement) {
                  const clippingStyle = getComputedStyle(clippingNode);
                  const clipsX = /hidden|clip/.test(clippingStyle.overflowX);
                  const clipsY = /hidden|clip/.test(clippingStyle.overflowY);
                  if (clipsX || clipsY) {
                    const clippingRect = clippingNode.getBoundingClientRect();
                    const positionedRect = positionTarget.getBoundingClientRect();
                    if (
                      (clipsX && (
                        positionedRect.left < clippingRect.left - 0.5
                        || positionedRect.right > clippingRect.right + 0.5
                      ))
                      || (clipsY && (
                        positionedRect.top < clippingRect.top - 0.5
                        || positionedRect.bottom > clippingRect.bottom + 0.5
                      ))
                    ) {
                      clippingAncestors.push(
                        clippingNode.className
                        || clippingNode.id
                        || clippingNode.tagName,
                      );
                    }
                  }
                  if (clippingNode === root) break;
                  clippingNode = clippingNode.parentElement;
                }
                const inlineTranslate = positionTarget.style.getPropertyValue('translate');
                const inlineTranslatePriority = positionTarget.style.getPropertyPriority('translate');
                positionTarget.style.setProperty('translate', 'none', 'important');
                void positionTarget.getBoundingClientRect();
                const untranslatedCenter = measureCenter(positionTarget);
                positionTarget.style.removeProperty('translate');
                if (inlineTranslate) {
                  positionTarget.style.setProperty('translate', inlineTranslate, inlineTranslatePriority);
                }
                void positionTarget.getBoundingClientRect();
                return {
                  key,
                  found: true,
                  visible: true,
                  mode: hasAbsolutePosition ? 'absolute' : 'relative',
                  expected_x_pct: hasAbsolutePosition ? Number(wordStyle.abs_x_pct) : null,
                  expected_y_pct: hasAbsolutePosition ? Number(wordStyle.abs_y_pct) : null,
                  source_x: Number(wordStyle.x || 0),
                  source_y: Number(wordStyle.y || 0),
                  applied_translate: getComputedStyle(positionTarget).translate,
                  target_display: targetDisplay,
                  target_font_family: getComputedStyle(positionTarget).fontFamily,
                  target_font_size: getComputedStyle(positionTarget).fontSize,
                  target_color: getComputedStyle(positionTarget).color,
                  target_inline_style: positionTarget.getAttribute('style') || '',
                  absolute_cpt_emphasis: node.dataset.absoluteCptEmphasis || null,
                  word_opacity: Number.parseFloat(getComputedStyle(node).opacity || '1'),
                  target_opacity: Number.parseFloat(getComputedStyle(motionTarget).opacity || '1'),
                  target_animation_name: getComputedStyle(motionTarget).animationName,
                  clipped_by_overflow: clippingAncestors.length > 0,
                  clipping_ancestors: clippingAncestors,
                  effective_dx: translatedCenter.x - untranslatedCenter.x,
                  effective_dy: translatedCenter.y - untranslatedCenter.y,
                  actual_x_pct: (((left + right) / 2 - rootRect.left) / rootRect.width) * 100,
                  actual_y_pct: (((top + bottom) / 2 - rootRect.top) / rootRect.height) * 100,
                };
              }));
          }, payload, renderTime);
          wordPositionAudits.push({ time: renderTime, words: frameWordPositions });
        }

        const hasCaptionEndingAtSegment = (payload.captions || []).some((caption) => {
          const end = Number(caption.end_time ?? caption.start_time ?? 0);
          const isTemplate = Boolean(
            caption.template_id
            || caption.template_20_id
            || caption.applied_template_style?.template_id
            || caption.applied_template_style?.template_20_id
            || payload.style?.template_id
            || payload.style?.template_20_id
          );
          return (isTemplate || payload.__geometry_audit) && Math.abs(end - segment.end) <= 0.002;
        });
        const endingCaptionAudits = hasCaptionEndingAtSegment
          ? await page.evaluate((currentPayload, currentTime, segmentEnd) => {
          const normalizeTokens = (value) => String(value || '')
            .normalize('NFC')
            .trim()
            .toLocaleLowerCase()
            .split(/\s+/)
            .filter(Boolean);
          const isVisibleTextParent = (element, boundary) => {
            if (!(element instanceof HTMLElement)) return false;
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            let node = element;
            while (node && node !== boundary.parentElement) {
              const computed = getComputedStyle(node);
              if (
                computed.display === 'none'
                || computed.visibility === 'hidden'
                || Number.parseFloat(computed.opacity || '1') <= 0.001
              ) {
                return false;
              }
              if (node === boundary) break;
              node = node.parentElement;
            }
            return true;
          };
          const containsWordSequence = (renderedTokens, expectedTokens) => {
            let cursor = 0;
            for (const token of renderedTokens) {
              if (token === expectedTokens[cursor]) cursor += 1;
              if (cursor === expectedTokens.length) return true;
            }
            return expectedTokens.length === 0;
          };

          const activeCaptions = (currentPayload.captions || []).filter((caption) => {
            const start = Number(caption.start_time ?? 0);
            const end = Number(caption.end_time ?? start);
            return currentTime >= start && currentTime < end;
          });

          return activeCaptions.map((caption, activeIndex) => {
            const end = Number(caption.end_time ?? caption.start_time ?? 0);
            const isTemplate = Boolean(
              caption.template_id
              || caption.template_20_id
              || caption.applied_template_style?.template_id
              || caption.applied_template_style?.template_20_id
              || currentPayload.style?.template_id
              || currentPayload.style?.template_20_id
            );
            if ((!isTemplate && !currentPayload.__geometry_audit) || Math.abs(end - segmentEnd) > 0.002) return null;
            const anchor = document.querySelector(`[data-caption-render-index="${activeIndex}"]`);
            if (!anchor) {
              return {
                captionId: String(caption.id || ''),
                complete: false,
                expectedWords: normalizeTokens(caption.text),
                renderedWords: [],
                reason: 'missing caption anchor',
              };
            }

            const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
            const visibleText = [];
            const visualWords = [];
            let textNode = walker.nextNode();
            while (textNode) {
              if (
                String(textNode.nodeValue || '').trim()
                && isVisibleTextParent(textNode.parentElement, anchor)
              ) {
                visibleText.push(textNode.nodeValue);
                for (const match of String(textNode.nodeValue || '').matchAll(/\S+/g)) {
                  const range = document.createRange();
                  range.setStart(textNode, match.index);
                  range.setEnd(textNode, match.index + match[0].length);
                  const rect = Array.from(range.getClientRects())
                    .find((item) => item.width > 0 && item.height > 0);
                  range.detach?.();
                  if (!rect) continue;
                  visualWords.push({
                    text: match[0].normalize('NFC').toLocaleLowerCase(),
                    top: rect.top,
                    left: rect.left,
                  });
                }
              }
              textNode = walker.nextNode();
            }
            const expectedWords = normalizeTokens(caption.text);
            const renderedWords = normalizeTokens(visibleText.join(' '));
            const dedupedVisualWords = visualWords.filter((word, wordIndex) => (
              visualWords.findIndex((candidate) => (
                candidate.text === word.text
                && Math.abs(candidate.top - word.top) < 0.5
                && Math.abs(candidate.left - word.left) < 0.5
              )) === wordIndex
            ));
            const visualLines = new Map();
            dedupedVisualWords.forEach((word, wordIndex) => {
              const lineKey = Math.round(word.top / 4) * 4;
              const lineWords = visualLines.get(lineKey) || [];
              lineWords.push({ ...word, wordIndex });
              visualLines.set(lineKey, lineWords);
            });
            const renderedLineTexts = Array.from(visualLines.entries())
              .sort(([topA], [topB]) => topA - topB)
              .map(([, lineWords]) => lineWords
                .sort((left, right) => left.left - right.left || left.wordIndex - right.wordIndex)
                .map((word) => word.text)
                .join(' ')
                .trim())
              .filter(Boolean);
            const expectedLineTexts = Array.isArray(caption.preview_template_line_texts)
              ? caption.preview_template_line_texts
                .map((line) => normalizeTokens(line).join(' '))
                .filter(Boolean)
              : [];
            const lineComplete = expectedLineTexts.length === 0
              || (
                expectedLineTexts.length === renderedLineTexts.length
                && expectedLineTexts.every((line, lineIndex) => line === renderedLineTexts[lineIndex])
              );
            const emphasisByLine = new Map();
            Array.from(anchor.querySelectorAll('.is-emphasis')).forEach((word) => {
              if (!isVisibleTextParent(word, anchor)) return;
              const line = word.parentElement || anchor;
              const lineWords = emphasisByLine.get(line) || [];
              const styles = getComputedStyle(word);
              lineWords.push({
                text: String(word.textContent || '').trim(),
                color: styles.color,
                underlined: styles.textDecorationLine.includes('underline')
                  || (styles.borderBottomStyle !== 'none' && parseFloat(styles.borderBottomWidth) > 0),
              });
              emphasisByLine.set(line, lineWords);
            });
            const pairedEmphasisLines = Array.from(emphasisByLine.values())
              .filter((lineWords) => lineWords.length >= 2);
            // Highlighted = the semantic keyword(s) plus the template's own hero
            // word(s). The hero pass can strip .is-emphasis and leave only an
            // inline accent colour, so that colour counts as a highlight too.
            const highlightedWords = Array.from(anchor.querySelectorAll('.w, .wbw-word, .sw, .sw-w, .is-emphasis'))
              .filter((word) => isVisibleTextParent(word, anchor) && (
                word.matches('.is-emphasis, [data-hero-emphasis="true"], .hero, .ns3hero, .ns3box, .ns3mark, .ns3bracket, .ns3dot')
                || Boolean(word.style.getPropertyValue('color'))
              ))
              .map((word) => {
                const styles = getComputedStyle(word);
                return {
                  text: String(word.textContent || '').trim(),
                  color: styles.color,
                  fontWeight: styles.fontWeight,
                };
              });
            return {
              captionId: String(caption.id || ''),
              complete: containsWordSequence(renderedWords, expectedWords) && lineComplete,
              expectedWords,
              renderedWords,
              expectedLineTexts,
              renderedLineTexts,
              pairedEmphasisLines,
              pairedEmphasisColorsMatch: pairedEmphasisLines.every((lineWords) => (
                new Set(lineWords.map((word) => word.color)).size === 1
              )),
              pairedEmphasisUnderlinesMatch: pairedEmphasisLines.every((lineWords) => (
                !lineWords.some((word) => word.underlined)
                || lineWords.every((word) => word.underlined)
              )),
              highlightedWords,
              highlightedWeightsMatch: new Set(highlightedWords.map((word) => word.fontWeight)).size <= 1,
              // Opt-in (TEMPLATE_OVERLAY_GEOMETRY_AUDIT=1): each word's centre and
              // size as a fraction of the frame, to compare with the canvas.
              wordGeometry: currentPayload.__geometry_audit
                ? Array.from(anchor.querySelectorAll('[data-word-key]'))
                  .filter((word) => isVisibleTextParent(word, anchor))
                  .map((word) => {
                    const visual = word.querySelector('[data-source-word-visual="true"], [data-word-drag-visual="true"]') || word;
                    const rect = visual.getBoundingClientRect();
                    const styles = getComputedStyle(visual);
                    return {
                      text: String(visual.textContent || '').trim(),
                      wordIndex: Number(String(word.dataset.wordKey).slice(String(caption.id).length + 1)),
                      cx: (rect.left + rect.width / 2) / window.innerWidth,
                      cy: (rect.top + rect.height / 2) / window.innerHeight,
                      fs: Number.parseFloat(styles.fontSize) / window.innerWidth,
                      color: styles.webkitTextFillColor || styles.color,
                      emphasis: word.classList.contains('is-emphasis'),
                    };
                  })
                : undefined,
              boxGeometry: currentPayload.__geometry_audit
                ? ['#overlay-root', ':scope', '.lekha-sidebar-export-template-shell', '.sb.active, .sblock.active', '.cpt, .nline', '.lc-card, .card'].map((selector) => {
                  const element = selector === ':scope'
                    ? anchor
                    : (selector === '#overlay-root' ? document.querySelector(selector) : anchor.querySelector(selector));
                  if (!element) return null;
                  const rect = element.getBoundingClientRect();
                  return {
                    selector,
                    transform: getComputedStyle(element).transform,
                    left: rect.left / window.innerWidth,
                    right: rect.right / window.innerWidth,
                    top: rect.top / window.innerHeight,
                    bottom: rect.bottom / window.innerHeight,
                  };
                })
                : undefined,
              script: caption.__export_script || 'latin',
            };
          }).filter(Boolean);
          }, payload, renderTime, segment.end)
          : [];
        completenessAudits.push(...endingCaptionAudits);
        const incompleteAudit = endingCaptionAudits.find((audit) => !audit.complete);
        if (incompleteAudit) {
          throw new Error(
            `[Template DOM] incomplete final template frame for caption ${incompleteAudit.captionId}: `
            + `expected=${JSON.stringify(incompleteAudit.expectedWords)} `
            + `rendered=${JSON.stringify(incompleteAudit.renderedWords)} `
            + `expected_lines=${JSON.stringify(incompleteAudit.expectedLineTexts)} `
            + `rendered_lines=${JSON.stringify(incompleteAudit.renderedLineTexts)}`
          );
        }

        const disk = await fs.statfs(outputDir);
        if (Number(disk.bavail) * Number(disk.bsize) < 256 * 1024 * 1024) {
          throw new Error('Insufficient temporary disk space for overlay frames');
        }
        await page.screenshot({
          path: framePath,
          omitBackground: true,
          optimizeForSpeed: true,
        });
        renderedFramePath = framePath;
      }

      frameFiles.push(renderedFramePath);
      frameLines.push(`file '${toForwardSlash(renderedFramePath).replace(/'/g, "'\\''")}'`);
      if (index < lastIndex) {
        frameLines.push(`duration ${segment.duration.toFixed(6)}`);
      }
    }

    if (process.env.TEMPLATE_OVERLAY_DEBUG === '1') {
      const debugInfo = await page.evaluate(() => {
        const word = document.querySelector('.lekha-original-template .w');
        const container = word ? word.parentElement : null;
        const block = document.querySelector('.lekha-original-template .sblock, .lekha-original-template [class*="-block"]');
        const describe = (el) => el ? {
          tag: el.tagName,
          className: String(el.className),
          fontSize: getComputedStyle(el).fontSize,
          fontFamily: getComputedStyle(el).fontFamily,
          transform: getComputedStyle(el).transform,
        } : null;
        const fontRules = [];
        if (word) {
          for (const sheet of document.styleSheets) {
            let rules = [];
            try { rules = sheet.cssRules || []; } catch { continue; }
            for (const rule of rules) {
              if (!rule.selectorText || !rule.style || !rule.style.fontSize) continue;
              try {
                if (word.matches(rule.selectorText)) {
                  fontRules.push({ selector: rule.selectorText, fontSize: rule.style.fontSize, priority: rule.style.getPropertyPriority('font-size') });
                }
              } catch { /* invalid selector for matches() */ }
            }
          }
        }
        return {
          word: describe(word),
          container: describe(container),
          block: describe(block),
          fontRules,
          shellHtml: (document.querySelector('.template-caption-shell')?.outerHTML || '').slice(0, 600),
        };
      });
      console.log('[Template DOM debug]', JSON.stringify(debugInfo, null, 2));
    }

    const lastFramePath = frameFiles[lastIndex] || blankFramePath;
    frameLines.push(`file '${toForwardSlash(lastFramePath).replace(/'/g, "'\\''")}'`);

    await fs.writeFile(path.join(outputDir, 'frames.txt'), `${frameLines.join('\n')}\n`, 'utf8');
    await fs.writeFile(path.join(outputDir, 'segments.json'), JSON.stringify(segments, null, 2), 'utf8');
    await fs.writeFile(
      path.join(outputDir, 'template-completeness-audit.json'),
      JSON.stringify(completenessAudits, null, 2),
      'utf8',
    );
    if (shouldAuditWordPositions) {
      await fs.writeFile(
        path.join(outputDir, 'word-position-audit.json'),
        JSON.stringify(wordPositionAudits, null, 2),
        'utf8',
      );
    }
  } finally {
    if (isolatedContext) {
      try {
        await isolatedContext.close();
      } finally {
        browser.disconnect();
      }
    } else {
      await browser.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
