import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const ADVANCED_TEMPLATE_VARIANTS = {
  t01: 'wbw-rise', t02: 'plain-s', t03: 'wbw-rise', t04: 'plain-s', t05: 'wbw-rise',
  t06: 'wbw-rise', t07: 'wbw-rise', t08: 'wbw-rise', t09: 'wbw-rise', t10: 'wbw-rise',
  t11: 'wbw-slide', t12: 'plain-s', t13: 'wbw-rise', t14: 'wbw-slide', t15: 'plain-s',
  t16: 'wbw-rise', t17: 'wbw-slide', t18: 'wbw-rise', t19: 'wbw-rise', t20: 'plain-s',
  t21: 'wbw-rise', t22: 'wbw-rise', t23: 'wbw-rise', t24: 'wbw-rise', t25: 'wbw-slide',
  t26: 'wbw-rise', t27: 'plain-s', t28: 'wbw-rise', t29: 'wbw-rise', t30: 'wbw-slide',
  t31: 'wbw-rise', t32: 'plain-s', t33: 'wbw-rise', t34: 'wbw-rise', t35: 'wbw-rise',
};
const TEMPLATE_CANVAS_FONT_SCALE = 0.88;

function findChromeExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => {
    try {
      return existsSync(candidate);
    } catch {
      return false;
    }
  });
}

function toForwardSlash(inputPath) {
  return inputPath.replace(/\\/g, '/');
}

function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

function scaleTemplateFontSize(fontSize) {
  return Math.max(12, Math.round((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
}

function buildRuntimeScript() {
  return `
    const escapeHtml = (value = '') =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const rgbaFromHex = (hex, alpha = 1) => {
      try {
        const normalized = String(hex || '#000000').replace('#', '');
        const full = normalized.length === 3
          ? normalized.split('').map((part) => part + part).join('')
          : normalized.padEnd(6, '0').slice(0, 6);
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
      } catch {
        return hex || '#000000';
      }
    };

    const transformText = (text, style) => {
      if (!text) return '';
      if (style?.is_caps || style?.text_case === 'uppercase') return text.toUpperCase();
      if (style?.text_case === 'lowercase') return text.toLowerCase();
      if (style?.text_case === 'capitalize') return text.replace(/\\b\\w/g, (char) => char.toUpperCase());
      return text;
    };

    const getCurrentWordIndex = (caption, time) => {
      const words = Array.isArray(caption.words) ? caption.words.filter((word) => (word?.word || '').trim()) : [];
      if (words.length > 0) {
        let activeIndex = 0;
        for (let index = 0; index < words.length; index += 1) {
          const start = Number(words[index]?.start ?? caption.start_time ?? 0);
          if (time >= start) activeIndex = index;
          else break;
        }
        return activeIndex;
      }

      const splitWords = String(caption.text || '').split(/\\s+/).filter(Boolean);
      if (splitWords.length <= 1) return 0;
      const start = Number(caption.start_time ?? 0);
      const end = Number(caption.end_time ?? start);
      const duration = Math.max(end - start, 0.01);
      const elapsed = Math.min(Math.max(time - start, 0), duration);
      return Math.max(0, Math.min(splitWords.length - 1, Math.floor((elapsed / duration) * splitWords.length)));
    };

    const buildWordMeta = (caption) => {
      const splitWords = String(caption.text || '').split(/\\s+/).filter(Boolean);
      const styled = caption.word_styles || {};
      return splitWords.map((word, index) => ({
        text: word,
        key: \`\${caption.id}-\${index}\`,
        style: styled[\`\${caption.id}-\${index}\`] || {},
      }));
    };

    const buildTemplateMarkup = (caption, globalStyle, time) => {
      const words = buildWordMeta(caption);
      const captionStart = Number(caption.start_time ?? 0);
      const captionEnd = Number(caption.end_time ?? captionStart);
      const captionDuration = Math.max(captionEnd - captionStart, 0.01);
      const elapsed = Math.min(Math.max(time - captionStart, 0), captionDuration);
      const currentIndex = words.length > 1
        ? Math.max(0, Math.min(words.length - 1, Math.floor((elapsed / captionDuration) * words.length)))
        : 0;
      const showInactive = globalStyle?.show_inactive !== false;
      const wordSpacing = \`\${(globalStyle?.word_spacing ?? 1) * 2}px\`;
      const advancedTemplateVariants = ${JSON.stringify(ADVANCED_TEMPLATE_VARIANTS)};
      const isAdvancedTemplate = ${isAdvancedTemplateId.toString()}(globalStyle?.template_id);
      const wrapperClassName = isAdvancedTemplate
        ? \`\${advancedTemplateVariants[globalStyle?.template_id] || 'wbw-rise'} \${globalStyle?.template_id || ''}\`
        : 'cap-text';

      const flowedWords = words
        .map((word, index) => {
          if (!showInactive && index > currentIndex) return '';

          const wordStyle = word.style || {};
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          let className = 'word';
          if (isCurrent) className += ' current active';
          else if (isPast) className += ' active done';
          if (wordStyle.isEmphasis) className += ' imp';
          if (isAdvancedTemplate) {
            className = ['w', isPast || isCurrent ? 'in' : '', wordStyle.isEmphasis ? 'imp-bold' : '']
              .filter(Boolean)
              .join(' ');
          }

          const inline = [];
          if (wordStyle.color) inline.push(\`color:\${wordStyle.color}\`);
          if (wordStyle.fontFamily) inline.push(\`font-family:"\${wordStyle.fontFamily}"\`);
          if (wordStyle.fontSize) inline.push(\`font-size:\${scaleTemplateFontSize(wordStyle.fontSize)}px\`);
          if (wordStyle.fontWeight) inline.push(\`font-weight:\${wordStyle.fontWeight}\`);
          if (wordStyle.fontStyle) inline.push(\`font-style:\${wordStyle.fontStyle}\`);
          if (index < words.length - 1) inline.push(\`margin-right:\${wordSpacing}\`);

          return \`<span data-word-key="\${word.key}" class="\${className}" style="\${inline.join(';')}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
        })
        .filter(Boolean)
        .join('');

      const positionedWords = words
        .filter((word) => word.style?.abs_x_pct !== undefined && word.style?.abs_y_pct !== undefined)
        .map((word) => {
          const inline = [
            'position:absolute',
            \`left:\${word.style.abs_x_pct}%\`,
            \`top:\${word.style.abs_y_pct}%\`,
            'transform:translate(-50%, -50%)',
            'display:inline-block',
            'white-space:pre',
            \`font-family:"\${word.style.fontFamily || globalStyle?.font_family || 'Inter'}"\`,
            \`font-size:\${scaleTemplateFontSize(word.style.fontSize || globalStyle?.font_size || 18)}px\`,
            \`font-weight:\${word.style.fontWeight || globalStyle?.font_weight || '500'}\`,
            \`font-style:\${word.style.fontStyle || globalStyle?.font_style || 'normal'}\`,
            \`color:\${word.style.color || globalStyle?.text_color || '#ffffff'}\`,
          ];
          return \`<span class="export-positioned-word" style="\${inline.join(';')}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
        })
        .join('');

      const styleVars = [
        \`--template-primary:\${globalStyle?.text_color || '#ffffff'}\`,
        \`--template-secondary:\${globalStyle?.secondary_color || '#000000'}\`,
        \`--template-bg:\${globalStyle?.background_color || 'transparent'}\`,
        \`--template-highlight:\${globalStyle?.highlight_color || '#FFE600'}\`,
      ];

      return \`
        <div class="template-caption-shell" style="\${styleVars.join(';')}">
          <div class="\${globalStyle?.template_id || ''}">
            <span class="\${wrapperClassName}" style="
              font-family:'\${globalStyle?.font_family || 'Inter'}';
              font-size:\${scaleTemplateFontSize(globalStyle?.font_size || 18)}px;
              font-weight:\${globalStyle?.font_weight || '500'};
              font-style:\${globalStyle?.font_style || 'normal'};
              text-align:\${globalStyle?.text_align || 'center'};
              letter-spacing:\${globalStyle?.letter_spacing || 0}px;
            ">\${flowedWords}</span>
          </div>
          \${positionedWords}
        </div>
      \`;
    };

    const buildPlainCaptionMarkup = (caption, globalStyle, time) => {
      const words = buildWordMeta(caption);
      const currentIndex = getCurrentWordIndex(caption, time);
      const showInactive = globalStyle?.show_inactive !== false;
      const wordSpacing = \`\${(globalStyle?.word_spacing ?? 1) * 2}px\`;

      const wordMarkup = words
        .map((word, index) => {
          if (!showInactive && index > currentIndex) return '';
          const wordStyle = word.style || {};
          const baseColor = wordStyle.color || globalStyle?.text_color || '#ffffff';
          const inline = [
            'display:inline-block',
            'position:relative',
            \`font-family:"\${wordStyle.fontFamily || globalStyle?.font_family || 'Inter'}"\`,
            \`font-size:\${wordStyle.fontSize || globalStyle?.font_size || 18}px\`,
            \`font-weight:\${wordStyle.fontWeight || globalStyle?.font_weight || '500'}\`,
            \`font-style:\${wordStyle.fontStyle || globalStyle?.font_style || 'normal'}\`,
            \`color:\${baseColor}\`,
            index < words.length - 1 ? \`margin-right:\${wordSpacing}\` : '',
          ].filter(Boolean);
          if (globalStyle?.has_stroke) inline.push(\`-webkit-text-stroke:\${globalStyle.stroke_width || 1}px \${globalStyle.stroke_color || '#000000'}\`);
          if (globalStyle?.has_shadow) inline.push(\`text-shadow:\${globalStyle.shadow_offset_x || 0}px \${globalStyle.shadow_offset_y || 2}px \${globalStyle.shadow_blur || 4}px \${globalStyle.shadow_color || '#000000'}\`);
          if (wordStyle.backgroundColor) {
            inline.push(\`background:\${rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6)}\`);
            inline.push(\`padding:\${wordStyle.backgroundPadding || 2}px \${(wordStyle.backgroundPadding || 2) * 2}px\`);
            inline.push('border-radius:4px');
          }
          return \`<span data-word-key="\${word.key}" style="\${inline.join(';')}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
        })
        .filter(Boolean)
        .join('');

      return \`
        <div class="plain-caption-shell">
          <span class="cap-text" style="
            font-family:'\${globalStyle?.font_family || 'Inter'}';
            font-size:\${globalStyle?.font_size || 18}px;
            font-weight:\${globalStyle?.font_weight || '500'};
            font-style:\${globalStyle?.font_style || 'normal'};
            text-align:\${globalStyle?.text_align || 'center'};
            line-height:\${(globalStyle?.font_size || 18) * (globalStyle?.line_spacing || 1.4)}px;
            \${globalStyle?.has_background ? \`background:\${rgbaFromHex(globalStyle.background_color || '#000000', globalStyle.background_opacity ?? 0.7)};padding:\${globalStyle.background_padding || 6}px \${(globalStyle.background_padding || 6) * 2}px;border-radius:8px;\` : ''}
          ">\${wordMarkup}</span>
        </div>
      \`;
    };

    const buildTextElementMarkup = (caption) => {
      const custom = caption.custom_style || {};
      return \`
        <div class="text-element-shell" style="
          position:absolute;
          left:\${custom.position_x ?? 50}%;
          top:\${custom.position_y ?? 50}%;
          transform:translate(-50%, -50%);
          text-align:\${custom.text_align || 'center'};
          pointer-events:none;
        ">
          <span style="
            display:inline-block;
            white-space:pre-wrap;
            font-family:'\${custom.font_family || 'Inter'}';
            font-size:\${custom.font_size || 18}px;
            font-weight:\${custom.font_weight || '500'};
            font-style:\${custom.font_style || 'normal'};
            color:\${custom.text_color || '#ffffff'};
            \${custom.has_background ? \`background:\${rgbaFromHex(custom.background_color || '#000000', custom.background_opacity ?? 0.6)};padding:\${custom.padding || 8}px;border-radius:8px;\` : ''}
            \${custom.has_stroke ? \`-webkit-text-stroke:\${custom.stroke_width || 1}px \${custom.stroke_color || '#000000'};\` : ''}
            \${custom.has_shadow ? \`text-shadow:\${custom.shadow_offset_x || 0}px \${custom.shadow_offset_y || 2}px \${custom.shadow_blur || 4}px \${custom.shadow_color || '#000000'};\` : ''}
          ">\${escapeHtml(String(caption.text || '')).replace(/\\n/g, '<br/>')}</span>
        </div>
      \`;
    };

    window.__renderPayload = (payload, time) => {
      const root = document.getElementById('overlay-root');
      if (!root) return;
      const style = payload.style || {};
      const activeCaptions = (payload.captions || []).filter((caption) => {
        const start = Number(caption.start_time ?? 0);
        const end = Number(caption.end_time ?? start);
        return time >= start && time <= end;
      });

      root.innerHTML = activeCaptions.map((caption) => {
        if (caption.is_text_element) return buildTextElementMarkup(caption);
        const left = style.position_x ?? 50;
        const top = style.position_y ?? 75;
        const base = [
          'position:absolute',
          \`left:\${left}%\`,
          \`top:\${top}%\`,
          'transform:translate(-50%, -50%)',
          'pointer-events:none',
          'width:max-content',
          'max-width:90%',
          \`text-align:\${style.text_align || 'center'}\`,
        ];
        const inner = style.template_id
          ? buildTemplateMarkup(caption, style, time)
          : buildPlainCaptionMarkup(caption, style, time);
        return \`<div class="caption-anchor" style="\${base.join(';')}">\${inner}</div>\`;
      }).join('');
    };
  `;
}

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    throw new Error('Missing payload JSON path');
  }

  const payload = JSON.parse(await fs.readFile(payloadPath, 'utf8'));
  const outputDir = payload.output_dir || path.join(projectRoot, 'tmp-overlay');
  await fs.mkdir(outputDir, { recursive: true });

  const captionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplates.css'), 'utf8');
  const advancedCaptionCss = await fs.readFile(path.join(projectRoot, 'src', 'styles', 'captionTemplatesAdvanced.css'), 'utf8');
  const runtimeCss = `
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: transparent !important;
      overflow: hidden;
    }
    body {
      font-family: 'Inter', sans-serif;
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
    .cap-text,
    .plain-s,
    .wbw-rise,
    .wbw-slide {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      line-height: 1.2;
    }
    .export-positioned-word {
      pointer-events: none;
      white-space: pre;
    }
  `;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: {
      width: payload.video_width,
      height: payload.video_height,
      deviceScaleFactor: 1,
    },
  });

  try {
    const page = await browser.newPage();
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Archivo+Black&family=Bangers&family=Bebas+Neue&family=Bitter:wght@400;700&family=Bodoni+Moda:opsz,wght@6..96,400&family=Caveat:wght@400;700&family=Cinzel:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=Darker+Grotesque:wght@400;700;900&family=Dela+Gothic+One&family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;700&family=Inter:wght@400;500;700;800;900&family=Josefin+Sans:wght@300;400;700&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@400;500;700;800;900&family=Noto+Sans:wght@400;700;800;900&family=Oswald:wght@300;400;700&family=Overpass+Mono:wght@400;700&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Questrial&family=Righteous&family=Silkscreen:wght@400;700&family=Special+Elite&family=Space+Mono:wght@400;700&family=Staatliches&family=Unbounded:wght@300;700;900&display=swap" rel="stylesheet">
          <style>${runtimeCss}</style>
        </head>
        <body>
          <div id="overlay-root"></div>
          <script>${buildRuntimeScript()}</script>
        </body>
      </html>
    `, { waitUntil: 'networkidle0' });

    await page.addStyleTag({ content: captionCss });
    await page.addStyleTag({ content: advancedCaptionCss });
    await page.evaluate(() => document.fonts.ready);

    const segments = [];
    const points = new Set([0, Number(payload.duration || 0)]);
    const templateUsesPreviewTiming = Boolean(payload.style?.template_id);
    for (const caption of payload.captions || []) {
      const start = Number(caption.start_time ?? 0);
      const end = Number(caption.end_time ?? start);
      points.add(start);
      points.add(end);
      if (templateUsesPreviewTiming) {
        const splitWords = String(caption.text || '').split(/\s+/).filter(Boolean);
        const wordCount = Math.max(splitWords.length, 1);
        const segmentDuration = Math.max(end - start, 0) / wordCount;
        for (let index = 1; index < wordCount; index += 1) {
          points.add(start + (segmentDuration * index));
        }
      } else {
        for (const word of caption.words || []) {
          const wordStart = Number(word?.start ?? start);
          const wordEnd = Number(word?.end ?? wordStart);
          if (Number.isFinite(wordStart)) points.add(wordStart);
          if (Number.isFinite(wordEnd)) points.add(wordEnd);
        }
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

    const frameLines = [];
    const lastIndex = segments.length - 1;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const midpoint = segment.start + (segment.duration / 2);
      const settleMs = Math.max(40, Math.min(180, Math.round(segment.duration * 600)));
      const framePath = path.join(outputDir, `frame-${String(index).padStart(5, '0')}.png`);

      await page.evaluate(async (currentPayload, currentTime, currentSettleMs) => {
        window.__renderPayload(currentPayload, currentTime);
        await new Promise((resolve) => setTimeout(resolve, currentSettleMs));
      }, payload, midpoint, settleMs);

      await page.screenshot({
        path: framePath,
        omitBackground: true,
      });

      frameLines.push(`file '${toForwardSlash(framePath).replace(/'/g, "'\\''")}'`);
      if (index < lastIndex) {
        frameLines.push(`duration ${segment.duration.toFixed(6)}`);
      }
    }

    const lastFramePath = path.join(outputDir, `frame-${String(lastIndex).padStart(5, '0')}.png`);
    frameLines.push(`file '${toForwardSlash(lastFramePath).replace(/'/g, "'\\''")}'`);

    await fs.writeFile(path.join(outputDir, 'frames.txt'), `${frameLines.join('\n')}\n`, 'utf8');
    await fs.writeFile(path.join(outputDir, 'segments.json'), JSON.stringify(segments, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
