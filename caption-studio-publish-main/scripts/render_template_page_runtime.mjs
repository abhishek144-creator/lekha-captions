// Browser runtime builder extracted verbatim from the overlay renderer.
import { isAdvancedTemplateId } from "../src/components/dashboard/templateTextRules.js"
import { ADVANCED_IMP_ENTRANCES, ADVANCED_TEMPLATE_EMPHASIS_COLORS, ADVANCED_TEMPLATE_TIMING, LEGACY_TEMPLATE_TIMING, ORIGINAL_TEMPLATE_BLOCK_TYPES, RECREATED_ADVANCED_TEMPLATE_IDS, LC_TEMPLATE_TIMING, fitLcMotionScheduleToCaption, getLcMotionSchedule, getKeyframeTemplatePlaybackMs, KEYFRAME_ADVANCED_TEMPLATE_IDS, seekKeyframeTemplateAnimations } from "../src/components/dashboard/templateMotionConfig.js"
import { APPLIED_BASIC_TEMPLATE_FONT_SCALE } from "../src/components/dashboard/basicTemplateInline.js"
import { getCaptionWordRevealTimes, getCaptionWordStartTime } from "../src/components/dashboard/cptMotion.js"

export const ADVANCED_TEMPLATE_VARIANTS = {
  t01: 'wbw-rise', t02: 'plain-s', t03: 'wbw-rise', t04: 'plain-s', t05: 'wbw-rise',
  t06: 'wbw-rise', t07: 'wbw-rise', t08: 'wbw-rise', t09: 'wbw-rise', t10: 'wbw-rise',
  t11: 'wbw-slide', t12: 'plain-s', t13: 'wbw-rise', t14: 'wbw-slide', t15: 'plain-s',
  t16: 'wbw-rise', t17: 'wbw-slide', t18: 'wbw-rise', t19: 'wbw-rise', t20: 'plain-s',
  t21: 'wbw-rise', t22: 'wbw-rise', t23: 'wbw-rise', t24: 'wbw-rise', t25: 'wbw-slide',
  t26: 'wbw-rise', t27: 'plain-s', t28: 'wbw-rise', t29: 'wbw-rise', t30: 'wbw-slide',
  t31: 'wbw-rise', t32: 'plain-s', t33: 'wbw-rise', t34: 'wbw-rise', t35: 'wbw-rise',
};
export const TEMPLATE_CANVAS_FONT_SCALE = 0.88;
export const LINE_ANIMATION_DEFS = {
  rise: ['source-word-rise', 400, 'ease-out', 'both'],
  pan: ['source-word-pan', 500, 'ease-in-out', 'both'],
  fade: ['source-word-fade', 500, 'ease-in', 'both'],
  pop: ['source-word-pop', 300, 'ease-out', 'both'],
  wipe: ['source-word-wipe', 400, 'ease-out', 'both'],
  blur: ['source-word-blur', 500, 'ease-in-out', 'both'],
  succession: ['source-word-succession', 400, 'ease-out', 'both'],
  breathe: ['source-word-breathe', 1500, 'ease-in-out', 'infinite'],
  baseline: ['source-word-baseline', 400, 'ease-out', 'both'],
  drift: ['source-word-drift', 600, 'ease-in-out', 'both'],
  tectonic: ['source-word-tectonic', 500, 'ease-out', 'both'],
  tumble: ['source-word-tumble', 600, 'ease-in-out', 'both'],
  zoom_in: ['caption-zoom-in', 400, 'ease-out', 'both'],
  zoom_out: ['caption-zoom-out', 400, 'ease-out', 'both'],
  fade_in: ['caption-fade-in', 400, 'ease-out', 'both'],
  slide_up: ['caption-slide-up', 400, 'ease-out', 'both'],
  slide_down: ['caption-slide-down', 400, 'ease-out', 'both'],
  slide_left: ['caption-slide-left', 400, 'ease-out', 'both'],
  slide_right: ['caption-slide-right', 400, 'ease-out', 'both'],
  fadeInUp: ['caption-fade-in-up', 500, 'ease-out', 'both'],
  fadeInDown: ['caption-fade-in-down', 500, 'ease-out', 'both'],
  slideInRight: ['caption-slide-in-right', 500, 'ease-out', 'both'],
  flipInX: ['caption-flip-in-x', 600, 'ease-out', 'both'],
  flipInY: ['caption-flip-in-y', 600, 'ease-out', 'both'],
  blurIn: ['caption-blur-in', 500, 'ease-out', 'both'],
  zoomInFade: ['caption-zoom-in-fade', 500, 'ease-out', 'both'],
  bounceInUp: ['caption-bounce-in-up', 600, 'ease-out', 'both'],
  skewLeft: ['caption-skew-left', 400, 'ease-out', 'both'],
  missile: ['caption-missile', 500, 'cubic-bezier(0.22,1,0.36,1)', 'both'],
  shockwave: ['caption-shockwave', 500, 'ease-out', 'both'],
  typewriter: ['caption-typewriter', 600, 'steps(20,end)', 'both'],
  slamDown: ['caption-slam-down', 500, 'cubic-bezier(0.22,1,0.36,1)', 'both'],
  fireCharge: ['caption-fire-charge', 500, 'ease-out', 'both'],
  stampede: ['caption-stampede', 500, 'cubic-bezier(0.22,1,0.36,1)', 'both'],
  recoil: ['caption-recoil', 400, 'ease-out', 'both'],
  irisOpen: ['caption-iris-open', 600, 'ease-out', 'both'],
  parallaxRise: ['caption-parallax-rise', 700, 'ease-out', 'both'],
  goldenRatio: ['caption-golden-ratio', 600, 'ease-out', 'both'],
  curtainSplit: ['caption-curtain-split', 500, 'ease-out', 'both'],
  prestige: ['caption-prestige', 1000, 'ease-out', 'both'],
  fadeThroughBlack: ['caption-fade-through-black', 800, 'ease-in-out', 'both'],
  depthPull: ['caption-depth-pull', 600, 'ease-out', 'both'],
  slowBurn: ['caption-slow-burn', 1500, 'ease-in', 'both'],
  diagonalWipe: ['caption-diagonal-wipe', 500, 'ease-out', 'both'],
  confettiPop: ['caption-confetti-pop', 500, 'ease-out', 'both'],
  stickerSlap: ['caption-sticker-slap', 400, 'cubic-bezier(0.34,1.56,0.64,1)', 'both'],
  wobbleEntry: ['caption-wobble-entry', 600, 'ease-out', 'both'],
  balloonFloat: ['caption-balloon-float', 600, 'ease-out', 'both'],
  colorSplash: ['caption-color-splash', 500, 'ease-out', 'both'],
};
export const SIDEBAR_TEMPLATE_WORD_STAGGER_SECONDS = LEGACY_TEMPLATE_TIMING.wordStaggerMs / 1000;
export const SIDEBAR_TEMPLATE_POSITION_STAGGER_SECONDS = LEGACY_TEMPLATE_TIMING.positionedWordStaggerMs / 1000;

export function buildRuntimeScript(advancedTemplateBlockMarkup = {}) {
  return `
    const TEMPLATE_CANVAS_FONT_SCALE = ${TEMPLATE_CANVAS_FONT_SCALE};
    const scaleExportPx = (value) =>
      Math.max(1, Math.round((Number(value) || 0) * (window.__exportCanvasScale || 1)));
    const scaleTemplateFontSize = (fontSize) =>
      Math.max(12, scaleExportPx((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
    const APPLIED_BASIC_EXPORT_FONT_SCALE = ${JSON.stringify(APPLIED_BASIC_TEMPLATE_FONT_SCALE)};
    const LINE_ANIMATION_DEFS = ${JSON.stringify(LINE_ANIMATION_DEFS)};

    const getLineAnimationStyle = (animationType, speed = 1) => {
      const def = LINE_ANIMATION_DEFS[String(animationType || '')];
      if (!def) return 'none';
      const [name, durationMs, timing, fill] = def;
      const safeSpeed = Math.max(0.1, Number(speed) || 1);
      const duration = Math.max(1, Math.round(durationMs / safeSpeed));
      return \`\${name} \${duration}ms \${timing} \${fill}\`;
    };

    const normalizeComputedFontFamily = (value = '') => String(value || '')
      .split(',')[0]
      .replace(/["']/g, '')
      .trim();

    const applySourceTemplateScriptFonts = (root, script = 'latin') => {
      if (!root || !script || script === 'latin') return;
      const scriptConfig = window.__exportScriptFontMaps?.[script] || {};
      const familyMap = scriptConfig.families || {};
      const fallbackFamily = scriptConfig.fallback || '';
      if (!fallbackFamily) return;

      [root, ...root.querySelectorAll('*')].forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const baseFamily = normalizeComputedFontFamily(getComputedStyle(node).fontFamily);
        const resolvedFamily = familyMap[baseFamily] || fallbackFamily;
        if (!resolvedFamily || resolvedFamily === baseFamily) return;
        node.style.setProperty('font-family', \`'\${resolvedFamily}', sans-serif\`, 'important');
        node.dataset.exportScriptFont = resolvedFamily;
      });
    };

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

    const getCaptionWordStartTime = ${getCaptionWordStartTime.toString()};
    const getCaptionWordRevealTimes = ${getCaptionWordRevealTimes.toString()};
    const getCurrentWordIndex = (caption, time) => {
      const splitWords = String(caption.text || '').split(/\\s+/).filter(Boolean);
      const revealTimes = getCaptionWordRevealTimes(caption, Math.max(1, splitWords.length));
      let activeIndex = 0;
      for (let index = 0; index < revealTimes.length; index += 1) {
        if (time >= revealTimes[index]) activeIndex = index;
        else break;
      }
      return Math.max(0, Math.min(revealTimes.length - 1, activeIndex));
    };

    const resolveAdvancedTemplatePhaseIndex = (caption, fallbackIndex = 0) => {
      const storedPhaseIndex = Number(caption?.template_phase_index);
      if (Number.isFinite(storedPhaseIndex)) return storedPhaseIndex;
      const templateIndex = Number(caption?.__templateIndex);
      if (Number.isFinite(templateIndex)) return templateIndex;
      const legacyTemplateIndex = Number(caption?.__template_index);
      if (Number.isFinite(legacyTemplateIndex)) return legacyTemplateIndex;
      return Math.max(0, Number(fallbackIndex) || 0);
    };












    const heroMarkup = (text, className = '') => {
      const { top, hero, bottom, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      if (!className || !hero) return escapeHtml(full);
      return \`\${top ? \`\${escapeHtml(top)} \` : ''}<span class="\${className}">\${escapeHtml(hero)}</span>\${bottom ? \` \${escapeHtml(bottom)}\` : ''}\`;
    };

    const stillFramesMarkup = (text) =>
      \`<span class="still-frames-line">\${heroMarkup(text, 'imp-rose still-frames-highlight')}</span>\`;

    let activeTemplateImpWordIndices = [];

    const wbwMarkup = (text, variant = 'wbw-rise', impClass = 'imp-bold', options = {}) => {
      const { hero, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      const tokens = full.split(/\\s+/).filter(Boolean).map((word) => ({ word }));
      const heroIndex = Math.max(0, tokens.findIndex((token) => token.word === hero));
      const requestedImpWordIndices = options.impWordIndices?.length
        ? options.impWordIndices
        : activeTemplateImpWordIndices;
      const resolvedImpWordIndices = options.impWordIndices?.length
        ? resolveImpWordIndicesForWords(tokens, -1, requestedImpWordIndices)
        : requestedImpWordIndices.length
          ? resolveImpWordIndicesForWords(tokens, -1, requestedImpWordIndices)
        : resolveImpWordIndicesForWords(tokens);
      const emphasisIndices = new Set(resolvedImpWordIndices.length ? resolvedImpWordIndices : [heroIndex]);
      const lineMotion = String(options.motion || '');
      const lineClassName = String(options.lineClassName || '');
      const lineMotionAttr = lineMotion ? \` data-line-motion="\${escapeHtml(lineMotion)}"\` : '';
      const outerClass = \`\${variant} lekha-template-fit\${lineClassName ? \` \${lineClassName}\` : ''}\`;
      const indexedLines = options.compactLines
        ? splitCompactIndexedLines(tokens, options.lineTexts)
        : [];
      if (indexedLines.length > 1) {
        const markup = indexedLines.map((line) => {
          const lineWords = line.map((token, localIndex) => {
            const style = \`--wbw-delay:\${token.wordIndex * 65}ms\`;
            const isImp = emphasisIndices.has(token.wordIndex);
            return \`\${localIndex > 0 ? ' ' : ''}<span class="w\${isImp ? \` \${impClass}\` : ''} in" data-i="\${token.wordIndex}"\${lineMotionAttr}\${isImp ? \` data-imp="true" data-imp-cls="\${impClass}"\` : ''} style="\${style}">\${escapeHtml(token.word)}</span>\`;
          }).join('');
          return \`<span class="lekha-template-preview-line">\${lineWords}</span>\`;
        }).join('');
        return \`<span class="\${outerClass} lekha-template-preview-lines" data-type="\${variant}"\${lineMotionAttr}>\${markup}</span>\`;
      }
      const words = tokens.map((token, index) => {
        const style = \`--wbw-delay:\${index * 65}ms\`;
        const isImp = emphasisIndices.has(index);
        return \`\${index > 0 ? ' ' : ''}<span class="w\${isImp ? \` \${impClass}\` : ''} in" data-i="\${index}"\${lineMotionAttr}\${isImp ? \` data-imp="true" data-imp-cls="\${impClass}"\` : ''} style="\${style}">\${escapeHtml(token.word)}</span>\`;
      }).join('');
      return \`<span class="\${outerClass}" data-type="\${variant}"\${lineMotionAttr}>\${words}</span>\`;
    };

    const battleCryWbwMarkup = (text, variant = 'wbw-rise', impClass = 'imp-rose') => {
      const { hero, full } = splitCaptionForTemplate(text);
      if (!full) return '';
      const tokens = full.split(/\\s+/).filter(Boolean).map((word) => ({ word }));
      const heroIndex = Math.max(0, tokens.findIndex((token) => token.word === hero));
      const lines = splitBattleCryIndexedLines(tokens);
      const markup = lines.map((line, lineIndex) => {
        const lineMotion = lineIndex % 2 === 0 ? 'wbw-slide' : 'wbw-rise';
        const battleMotion = lineIndex % 2 === 0 ? 'sweep-left' : 'lift-up';
        const lineDelay = lineIndex * 170;
        const lineWords = line.map((token, localIndex) => {
          const isImp = token.wordIndex === heroIndex;
          const style = \`--wbw-delay:\${(localIndex * 58) + lineDelay}ms\`;
          return \`\${localIndex > 0 ? ' ' : ''}<span class="w\${isImp ? \` \${impClass} is-emphasis\` : ''} in" data-i="\${token.wordIndex}" data-line-motion="\${lineMotion}" data-line-delay="\${lineDelay}" data-battle-motion="\${battleMotion}" data-battle-index="\${localIndex}"\${isImp ? \` data-imp="true" data-imp-cls="\${impClass}"\` : ''} style="\${style}">\${escapeHtml(token.word)}</span>\`;
        }).join('');
        return \`<span class="lekha-template-preview-line battle-line-\${lineIndex + 1} \${lineMotion} battle-\${battleMotion}" data-battle-line="\${lineIndex}" data-line-motion="\${lineMotion}" data-battle-motion="\${battleMotion}">\${lineWords}</span>\`;
      }).join('');
      return \`<span class="\${variant} lekha-template-fit lekha-template-preview-lines battle-lines" data-type="\${variant}">\${markup}</span>\`;
    };

    const karaokeMarkup = (text) => {
      const words = String(text || '').trim().split(/\\s+/).filter(Boolean);
      return \`<span class="kf-line lekha-template-fit">\${words.map((word) => \`
        <span class="kf-word">
          <span class="kf-base">\${escapeHtml(word)}</span>
          <span class="kf-fill">\${escapeHtml(word)}</span>
        </span>
      \`).join(' ')}</span>\`;
    };

    const advancedTemplateBlockMarkup = ${JSON.stringify(advancedTemplateBlockMarkup)};

    const cleanAdvancedSourceElement = (element) => {
      if (!element) return;
      [element, ...element.querySelectorAll('*')].forEach((node) => {
        Array.from(node.attributes || []).forEach((attribute) => {
          if (/^bis_/i.test(attribute.name) || /^__processed_/i.test(attribute.name)) {
            node.removeAttribute(attribute.name);
          }
        });
        node.className = String(node.className || '')
          .split(/\\s+/)
          .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in', 'fx'].includes(className))
          .join(' ');
        if (node.style) {
          [
            'animation', 'clip-path', 'filter', 'opacity', 'transform', 'transform-origin',
            'transition', 'visibility', 'z-index',
          ].forEach((property) => node.style.removeProperty(property));
        }
      });
    };

    const mapAdvancedSourceClass = (sourceClasses, index, total, fallback) => {
      if (!sourceClasses.length) return fallback;
      if (total <= 1) return sourceClasses[0] || fallback;
      const sourceIndex = Math.min(
        sourceClasses.length - 1,
        Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1)),
      );
      return sourceClasses[sourceIndex] || fallback;
    };

    const ADVANCED_TEMPLATE_EMPHASIS_COLORS = ${JSON.stringify(ADVANCED_TEMPLATE_EMPHASIS_COLORS)};
    const resolveAdvancedTemplateEmphasisColor = (templateId, emphasisColor = '', blockIndex = -1) => {
      const normalizedId = String(templateId || '').trim();
      if (normalizedId === 't23' && Number(blockIndex) === 3) {
        return '#ffffff';
      }
      if (emphasisColor) {
        return emphasisColor;
      }
      return ADVANCED_TEMPLATE_EMPHASIS_COLORS[normalizedId] || '';
    };

    const replaceAdvancedSourceWbw = (container, words, impWordIndex, emphasisColor, impWordIndices = []) => {
      const doc = container.ownerDocument || document;
      const sourceWords = Array.from(container.querySelectorAll('.w'));
      const sourceClasses = sourceWords.map((word) => String(word.className || 'w'));
      const impPattern = /\\bimp-[\\w-]+\\b/;
      const sourceImpIndex = sourceWords.findIndex((word) => (
        word.dataset.imp === 'true' || impPattern.test(word.className)
      ));
      const impClass = sourceImpIndex >= 0
        ? sourceWords[sourceImpIndex].dataset.impCls
          || sourceClasses[sourceImpIndex].match(impPattern)?.[0]
          || ''
        : '';
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      container.textContent = '';
      container.dataset.text = words.join(' ');
      container.classList.remove('lekha-template-preview-lines');

      const createWordSpan = (word, index, isLastInLine) => {
        const span = doc.createElement('span');
        const mapped = mapAdvancedSourceClass(sourceClasses, index, words.length, 'w')
          .replace(/\\bimp-[\\w-]+\\b/g, '')
          .replace(/\\s+/g, ' ')
          .trim();
        const isImp = targetImpIndices.has(index);
        span.className = (mapped || 'w') + (isImp && impClass ? ' ' + impClass : '') + (isImp ? ' is-emphasis' : '');
        span.dataset.i = String(index);
        if (isImp) {
          span.dataset.imp = 'true';
          span.dataset.impCls = impClass;
          if (emphasisColor) {
            span.style.setProperty('color', emphasisColor, 'important');
            span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          }
        }
        if (!isLastInLine) {
          span.style.setProperty('margin-right', '0.24em', 'important');
        }
        span.textContent = word;
        return span;
      };

      words.forEach((word, index) => {
        container.appendChild(createWordSpan(word, index, index === words.length - 1));
      });
    };

    const replaceAdvancedSourceKaraoke = (container, words) => {
      container.textContent = '';
      words.forEach((word, index) => {
        if (index > 0) container.appendChild(document.createTextNode(' '));
        const wrapper = document.createElement('span');
        wrapper.className = 'kf-word';
        const base = document.createElement('span');
        base.className = 'kf-base';
        base.textContent = word;
        const fill = document.createElement('span');
        fill.className = 'kf-fill';
        fill.textContent = word;
        wrapper.append(base, fill);
        container.appendChild(wrapper);
      });
    };

    const collectAdvancedSourceTextNodes = (root) => {
      const textNodes = [];
      const isHiddenTextNode = (node) => {
        let element = node?.parentElement;
        while (element && element !== root.parentElement) {
          const style = String(element.getAttribute?.('style') || '').toLowerCase();
          if (
            element.hidden
            || element.getAttribute?.('aria-hidden') === 'true'
            || /display\\s*:\\s*none/.test(style)
            || /visibility\\s*:\\s*hidden/.test(style)
            || /font-size\\s*:\\s*0(?:\\.0+)?(?:px|rem|em|%)?(?:\\s*(?:;|$))/.test(style)
            || /line-height\\s*:\\s*0(?:\\.0+)?(?:px|rem|em|%)?(?:\\s*(?:;|$))/.test(style)
          ) {
            return true;
          }
          element = element.parentElement;
        }
        return false;
      };
      const visit = (node) => {
        Array.from(node.childNodes || []).forEach((child) => {
          if (child.nodeType === 3) {
            if (/[\\p{L}\\p{N}]/u.test(child.nodeValue || '') && !isHiddenTextNode(child)) textNodes.push(child);
            else if (String(child.nodeValue || '').trim()) child.nodeValue = '';
          } else if (child.nodeType === 1) {
            visit(child);
          }
        });
      };
      visit(root);
      return textNodes;
    };

    const assignAdvancedWordsToSlots = (words, slotCount) => {
      const assigned = Array.from({ length: Math.max(0, slotCount) }, () => []);
      if (!words.length || !assigned.length) return assigned;

      words.forEach((word, wordIndex) => {
        const slotIndex = words.length <= 1 || assigned.length <= 1
          ? 0
          : Math.min(
            assigned.length - 1,
            Math.round((wordIndex * (assigned.length - 1)) / Math.max(1, words.length - 1)),
          );
        assigned[slotIndex].push({ word, wordIndex });
      });

      assigned.forEach((slot, slotIndex) => {
        if (slot.length) return;
        let donorIndex = -1;
        let donorDistance = Infinity;
        assigned.forEach((candidate, candidateIndex) => {
          if (candidate.length <= 1) return;
          const distance = Math.abs(candidateIndex - slotIndex);
          if (distance < donorDistance) {
            donorDistance = distance;
            donorIndex = candidateIndex;
          }
        });
        if (donorIndex < 0) return;
        const donor = assigned[donorIndex];
        const moved = donorIndex < slotIndex ? donor.pop() : donor.shift();
        if (moved) slot.push(moved);
      });

      return assigned;
    };

    const advancedSourceImpPattern = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/;

    const getAdvancedSourceImpClass = (block) => {
      const className = Array.from(block.querySelectorAll('*'))
        .map((element) => element.className || '')
        .find((value) => advancedSourceImpPattern.test(String(value)));
      return String(className || '').match(advancedSourceImpPattern)?.[0] || 'imp-gold';
    };

    const findAdvancedSlotImpWrapper = (slot, block) => {
      let element = slot?.parentElement;
      while (element && element !== block) {
        if (advancedSourceImpPattern.test(String(element.className || ''))) return element;
        element = element.parentElement;
      }
      return null;
    };

    const replaceAdvancedTextSlot = (slot, assignedWords, impWordIndex, impClass, emphasisColor, block, impWordIndices = []) => {
      const doc = slot.ownerDocument;
      const source = String(slot.nodeValue || '');
      const leading = /^\\s/.test(source) ? ' ' : '';
      const trailing = /\\s$/.test(source) ? ' ' : '';
      const targetImpIndices = new Set(normalizeImpWordIndices(impWordIndex, impWordIndices));
      const replacementTarget = targetImpIndices.size > 0
        ? findAdvancedSlotImpWrapper(slot, block)
        : null;
      const fragment = doc.createDocumentFragment();
      if (leading) fragment.appendChild(doc.createTextNode(leading));
      assignedWords.forEach(({ word, wordIndex }, localIndex) => {
        if (localIndex > 0) fragment.appendChild(doc.createTextNode(' '));
        if (targetImpIndices.has(wordIndex)) {
          const span = doc.createElement('span');
          span.className = impClass + ' is-emphasis';
          span.dataset.w = String(wordIndex);
          span.dataset.imp = 'true';
          span.dataset.impCls = impClass;
          if (emphasisColor) {
            span.style.setProperty('color', emphasisColor, 'important');
            span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          }
          span.textContent = word;
          fragment.appendChild(span);
        } else {
          fragment.appendChild(doc.createTextNode(word));
        }
      });
      if (trailing) fragment.appendChild(doc.createTextNode(trailing));
      if (replacementTarget?.parentNode) {
        replacementTarget.parentNode.replaceChild(fragment, replacementTarget);
      } else {
        slot.parentNode?.replaceChild(fragment, slot);
      }
    };

    const findAdvancedSourceImpSlotIndex = (slots, block) => {
      if (!Array.isArray(slots) || !slots.length || !block) return -1;
      return slots.findIndex((slot) => !!findAdvancedSlotImpWrapper(slot, block));
    };

    const ensureAdvancedSourceImpSlotHasWord = (assigned, impSlotIndex) => {
      if (!Array.isArray(assigned) || impSlotIndex < 0 || impSlotIndex >= assigned.length) return;
      if (assigned[impSlotIndex]?.length) return;

      let donorIndex = -1;
      let donorDistance = Infinity;
      assigned.forEach((slot, slotIndex) => {
        if (!slot.length || slotIndex === impSlotIndex) return;
        const distance = Math.abs(slotIndex - impSlotIndex);
        if (distance < donorDistance) {
          donorIndex = slotIndex;
          donorDistance = distance;
        }
      });
      if (donorIndex < 0) return;

      const donor = assigned[donorIndex];
      const moved = donorIndex < impSlotIndex ? donor.pop() : donor.shift();
      if (moved) assigned[impSlotIndex].push(moved);
    };

    const replaceAdvancedSourceStyledText = (block, words, captionText, impWordIndex = -1, emphasisColor = '', impWordIndices = []) => {
      const slots = collectAdvancedSourceTextNodes(block);
      if (!slots.length) {
        block.textContent = captionText;
        return;
      }
      const targetSlotCount = Math.max(1, Math.min(words.length, slots.length));
      const targetSlots = slots.slice(0, targetSlotCount);
      const assigned = assignAdvancedWordsToSlots(words, targetSlots.length);
      const sourceImpSlotIndex = findAdvancedSourceImpSlotIndex(targetSlots, block);
      ensureAdvancedSourceImpSlotHasWord(assigned, sourceImpSlotIndex);
      const impClass = getAdvancedSourceImpClass(block);
      const resolvedImpWordIndices = resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices);
      targetSlots.forEach((slot, slotIndex) => {
        if (assigned[slotIndex].length) {
          replaceAdvancedTextSlot(slot, assigned[slotIndex], -1, impClass, emphasisColor, block, resolvedImpWordIndices);
        } else {
          slot.nodeValue = '';
        }
      });
      slots.slice(targetSlotCount).forEach((slot) => {
        slot.nodeValue = '';
      });
      block.querySelectorAll('[data-text]').forEach((element) => {
        element.setAttribute('data-text', captionText);
      });
    };


    const normalizeAdvancedSourceStyledBlock = (block, templateId, blockIndex, captionText = '', previewLineTexts = []) => {
      const rebuildSplitText = (container, lines, impClass = '') => {
        if (!container || !Array.isArray(lines) || !lines.length) return;
        const doc = container.ownerDocument || document;
        container.textContent = '';
        container.appendChild(doc.createTextNode(lines[0] || ''));
        if (lines[1]) {
          container.appendChild(doc.createElement('br'));
          if (impClass) {
            const span = doc.createElement('span');
            span.className = impClass + ' is-emphasis';
            span.dataset.imp = 'true';
            span.dataset.impCls = impClass;
            span.textContent = lines[1];
            container.appendChild(span);
          } else {
            container.appendChild(doc.createTextNode(lines[1]));
          }
        }
      };

      if (templateId === 't15' && blockIndex === 0) {
        const line = block.querySelector('.shake-in');
        if (line) {
          rebuildSplitText(line, splitTemplateLines(captionText, 2), getAdvancedSourceImpClass(block));
          line.classList.add('lekha-template-fit');
        }
        return;
      }

      if (templateId === 't17' && blockIndex === 1) {
        const snapText = block.querySelector('.snap-txt');
        if (snapText) {
          snapText.style.setProperty('display', 'inline-block', 'important');
          snapText.style.setProperty('opacity', '1', 'important');
          snapText.style.setProperty('filter', 'none', 'important');
          snapText.style.setProperty('transform', 'none', 'important');
          snapText.style.setProperty('letter-spacing', '0.04em', 'important');
          snapText.style.setProperty('color', '#ff3d71', 'important');
          snapText.style.setProperty('-webkit-text-fill-color', '#ff3d71', 'important');
          snapText.style.setProperty('text-shadow', '0 1px 8px rgba(0,0,0,0.82), 0 0 2px rgba(0,0,0,0.92), 0 0 16px rgba(255,61,113,0.22)', 'important');
          snapText.style.setProperty('animation', 'none', 'important');
          snapText.style.setProperty('transition', 'none', 'important');
          [snapText, ...snapText.querySelectorAll('*')].forEach((node) => {
            node.style.setProperty('color', '#ff3d71', 'important');
            node.style.setProperty('-webkit-text-fill-color', '#ff3d71', 'important');
          });
        }
        return;
      }

      if (templateId === 't18' && blockIndex === 0) {
        const lines = splitTemplateLines(captionText, 2);
        const splitTitle = block.querySelector('.split-title');
        if (splitTitle) {
          const doc = splitTitle.ownerDocument || document;
          splitTitle.textContent = '';
          const top = doc.createElement('span');
          top.className = 'split-top';
          top.textContent = lines[0] || captionText;
          splitTitle.appendChild(top);
          const bottom = doc.createElement('span');
          bottom.className = 'split-bot';
          if (lines[1]) {
            const imp = doc.createElement('span');
            imp.className = 'imp-purple is-emphasis';
            imp.dataset.imp = 'true';
            imp.dataset.impCls = 'imp-purple';
            imp.textContent = lines[1];
            bottom.appendChild(imp);
          }
          splitTitle.appendChild(bottom);
          splitTitle.classList.add('lekha-template-fit');
        }
        return;
      }

      if (templateId === 't38' && blockIndex === 0) {
        const line = block.querySelector('span');
        if (line) {
          const lines = resolveTemplatePreviewLines(captionText, previewLineTexts, 2);
          const doc = line.ownerDocument || document;
          line.textContent = '';
          line.classList.add('lekha-template-fit', 'lekha-template-preview-lines');
          lines.forEach((lineText, index) => {
            if (index > 0) line.appendChild(doc.createElement('br'));
            line.appendChild(doc.createTextNode(lineText));
          });
        }
        return;
      }

      if (templateId !== 't13') return;

      const selector = blockIndex === 0
        ? '.slide-crash'
        : blockIndex === 1
          ? '.ticker-txt'
          : '.wbw-rise, .wbw-slide, .wbw-seq-fade';

      const line = block.querySelector(selector);
      if (!line) return;

      line.classList.add('lekha-template-fit');
      if (shouldCompactTemplateLine(captionText)) {
        line.classList.add('t13-compact-line');
        line.style.setProperty('text-transform', 'none', 'important');
      }
    };

    const originalTemplateBlockTypes = ${JSON.stringify(ORIGINAL_TEMPLATE_BLOCK_TYPES)};
    const recreatedAdvancedTemplateIds = new Set(${JSON.stringify(RECREATED_ADVANCED_TEMPLATE_IDS)});
    const rebuildAdvancedWbwRiseBlock = (
      block,
      words,
      impWordIndex = -1,
      emphasisColor = '',
      templateId = '',
      blockIndex = 0,
      impWordIndices = [],
    ) => {
      if (!block || !words.length || !shouldRecreateAdvancedWbwPhase(templateId, blockIndex)) return;
      const doc = block.ownerDocument;
      const impClass = getRecreatedAdvancedWbwImpClass(templateId, blockIndex);
      const fallbackImpIndex = Number.isFinite(Number(impWordIndex)) && Number(impWordIndex) >= 0
        ? Math.min(words.length - 1, Number(impWordIndex))
        : Math.min(1, words.length - 1);
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
      block.textContent = '';
      const line = doc.createElement('span');
      line.className = 'wbw-rise lekha-template-fit';
      line.dataset.type = 'wbw-rise';
      words.forEach((word, index) => {
        if (index > 0) line.appendChild(doc.createTextNode(' '));
        const span = doc.createElement('span');
        const isImp = targetImpIndices.has(index);
        span.className = 'w' + (isImp ? ' ' + impClass + ' is-emphasis' : '');
        span.dataset.i = String(index);
        if (isImp) {
          span.dataset.imp = 'true';
          span.dataset.impCls = impClass;
          if (emphasisColor) {
            span.style.setProperty('color', emphasisColor, 'important');
            span.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          }
        }
        if (index < words.length - 1) {
          span.style.setProperty('margin-right', '0.24em', 'important');
        }
        span.textContent = word;
        line.appendChild(span);
      });
      block.appendChild(line);
    };

    const buildCanonicalAdvancedTemplateMarkup = (
      templateId,
      text,
      blockIndex = 0,
      impWordIndex = -1,
      emphasisColor = '',
      previewLineTexts = [],
      impWordIndices = [],
    ) => {
      if (recreatedAdvancedTemplateIds.has(String(templateId || '').trim())) return '';

      const blocks = advancedTemplateBlockMarkup[templateId] || [];
      if (!blocks.length) return '';
      const normalized = ((Number(blockIndex || 0) % blocks.length) + blocks.length) % blocks.length;
      const resolvedEmphasisColor = resolveAdvancedTemplateEmphasisColor(templateId, emphasisColor, normalized);
      const sourceMarkup = blocks[normalized] || '';
      if (!sourceMarkup) return '';
      const doc = new DOMParser().parseFromString(sourceMarkup, 'text/html');
      const block = doc.querySelector('.sblock');
      const words = String(text || '').trim().split(/\\s+/).filter(Boolean);
      if (!block || !words.length) return '';

      cleanAdvancedSourceElement(block);
      const blockType = originalTemplateBlockTypes[templateId]?.[normalized] || block.dataset.type || 'styled';
      block.classList.add(templateId + '-block', 'lekha-applied-advanced-template', 'lekha-advanced-source-block');
      block.dataset.templateBlockIndex = String(normalized);
      block.dataset.templateBlockType = blockType;
      block.style.opacity = '0';
      block.style.transition = 'none';
      rebuildAdvancedWbwRiseBlock(block, words, impWordIndex, resolvedEmphasisColor, templateId, normalized, impWordIndices);

      const wbwContainers = Array.from(block.querySelectorAll(
        '.wbw-rise, .wbw-slide, .wbw-seq, .wbw-seq-fade, .wbw-seq-flip',
      ));
      if (wbwContainers.length) {
        wbwContainers.forEach((container) => replaceAdvancedSourceWbw(container, words, impWordIndex, resolvedEmphasisColor, impWordIndices));
      } else {
        const karaokeContainers = Array.from(block.querySelectorAll('.kf-line'));
        if (karaokeContainers.length) {
          karaokeContainers.forEach((container) => replaceAdvancedSourceKaraoke(container, words));
        } else {
          const suppressSemanticEmphasis = shouldSuppressStyledSemanticEmphasis(templateId, blockType, block);
          replaceAdvancedSourceStyledText(
            block,
            words,
            text,
            suppressSemanticEmphasis ? -1 : impWordIndex,
            suppressSemanticEmphasis ? '' : resolvedEmphasisColor,
            suppressSemanticEmphasis ? [] : impWordIndices,
          );
        }
      }

      normalizeAdvancedSourceStyledBlock(block, templateId, normalized, text, previewLineTexts);

      return '<span class="lekha-original-template ' + templateId + ' ' + templateId + '-stage">'
        + block.outerHTML
        + '</span>';
    };

    window.__advancedTemplateTiming = ${JSON.stringify(ADVANCED_TEMPLATE_TIMING)};
    // Same seek used by the editor canvas (templateMotionConfig.js), inlined.
    const getKeyframeTemplatePlaybackMs = ${getKeyframeTemplatePlaybackMs.toString()};
    window.__keyframeAdvancedTemplateIds = new Set(${JSON.stringify(KEYFRAME_ADVANCED_TEMPLATE_IDS)});
    window.__seekKeyframeTemplateAnimations = ${seekKeyframeTemplateAnimations.toString()};
    window.__advancedImpEntrances = ${JSON.stringify(ADVANCED_IMP_ENTRANCES)};
    window.__getAdvancedPlaybackElapsedMs = (blockType, wordCount, captionDurationMs, rawElapsedMs) => {
      const timing = window.__advancedTemplateTiming || {};
      const getWindow = () => {
        if (blockType === 'plain') return 0;
        if (blockType === 'karaoke') return Number(timing.holdMs || 1650);
        if (String(blockType || '').startsWith('wbw-')) {
          const sequential = blockType === 'wbw-seq'
            || blockType === 'wbw-seq-fade'
            || blockType === 'wbw-seq-flip';
          const stagger = sequential
            ? Number(timing.sequentialStaggerMs || 145)
            : Number(timing.wordStaggerMs || 45);
          const duration = sequential
            ? Number(timing.sequentialDurationMs || 180)
            : Number(timing.emphasisDurationMs || 300);
          return (Math.max(0, Number(wordCount || 1) - 1) * stagger) + duration;
        }
        return Number(timing.styledDurationMs || 850);
      };
      const naturalWindowMs = getWindow();
      if (!naturalWindowMs) return 0;
      const durationMs = Math.max(0, Number(captionDurationMs) || 0);
      const targetWindowMs = durationMs > 0
        ? Math.max(220, Math.min(naturalWindowMs, durationMs * 0.78))
        : naturalWindowMs;
      const elapsedMs = Math.max(0, Number(rawElapsedMs) || 0);
      return Math.min(naturalWindowMs, elapsedMs * (naturalWindowMs / targetWindowMs));
    };

    const wrapOriginalTemplate = (templateId, blockClass, blockIndex, blockType, children, extraStyle = '') => \`
      <span class="lekha-original-template \${templateId} \${templateId}-stage">
        <span
          id="\${templateId}-b\${blockIndex}"
          class="sblock \${templateId}-block \${blockClass} lekha-applied-advanced-template"
          data-template-block-index="\${blockIndex}"
          data-template-block-type="\${blockType}"
          style="opacity:0;transition:none;\${extraStyle}"
        >\${children}</span>
      </span>
    \`;

    const buildOriginalAdvancedTemplateMarkup = (templateId, text, blockIndex = 0, previewLineTexts = [], impWordIndex = -1, impWordIndices = []) => {
      const { top, hero, bottom, full } = splitCaptionForTemplate(text);
      const blockTypes = originalTemplateBlockTypes[templateId] || ['styled'];
      const normalized = ((blockIndex % blockTypes.length) + blockTypes.length) % blockTypes.length;
      const blockType = blockTypes[normalized];
      const lines2 = splitTemplateLines(full, 2);
      const resolvedPreviewLines = resolveTemplatePreviewLines(full, previewLineTexts, 2);
      const compactLines2 = splitCompactIndexedLines(
        full.split(/\\s+/).filter(Boolean).map((word) => ({ word })),
        previewLineTexts,
      ).map((line) => line.map((token) => token.word).join(' '));
      const upperFull = full.toUpperCase();
      const compactFull = shouldCompactTemplateLine(full);
      const t13LineClass = compactFull ? 'lekha-template-fit t13-compact-line' : 'lekha-template-fit';
      const t13LineText = compactFull ? full : upperFull;
      activeTemplateImpWordIndices = resolveImpWordIndicesForWords(
        full.split(/\\s+/).filter(Boolean),
        impWordIndex,
        impWordIndices,
      );
      const lineSpans = (lines, cls, mapper = (line) => escapeHtml(line)) =>
        lines.map((line, index) => \`<span class="\${cls}" style="animation-delay:\${index * 0.1}s">\${mapper(line, index)}</span>\`).join('');
      const wrap = (blockClass, children, extraStyle = '') => wrapOriginalTemplate(templateId, blockClass, normalized, blockType, children, extraStyle);

      switch (templateId) {
        case 't11':
          if (normalized === 1) return wrap('t11-b1', \`<span class="blur-txt lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
          if (normalized === 2) return wrap('t11-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t11-b3', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          return wrap('t11-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
        case 't12':
          if (normalized === 1) return wrap('t12-b1', \`<span class="rise-unit lekha-template-fit">\${heroMarkup(full, 'imp-purple')}</span>\`);
          if (normalized === 2) return wrap('t12-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t12-b3', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          return wrap('t12-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-purple'));
        case 't13':
          if (normalized === 1) return wrap('t13-b1', wbwMarkup(full, 'wbw-slide', 'imp-bold'));
          if (normalized === 2) return wrap('t13-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t13-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-bold'));
          return wrap('t13-b0', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
        case 't14':
          if (normalized === 1) return wrap('t14-b1', \`<span class="drop-txt lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t14-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t14-b3', wbwMarkup(full, 'wbw-rise', 'imp-weight'));
          return wrap('t14-b0', \`<span style="perspective:600px" class="lekha-template-fit">\${lineSpans(lines2, 'flip-line', (line, index) => index === lines2.length - 1 ? heroMarkup(line, 'imp-underline') : escapeHtml(line))}</span>\`);
        case 't15':
          if (normalized === 1) return wrap('t15-b1', \`<span class="pop-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
          if (normalized === 2) return wrap('t15-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t15-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose'));
          return wrap('t15-b0', \`<span class="shake-in lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br>\${heroMarkup(lines2[1], 'imp-rose')}\` : ''}</span>\`);
        case 't16':
          if (normalized === 1) return wrap('t16-b1', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't16-neon', lineClassName: 't16-neon-words' }));
          if (normalized === 2) return wrap('t16-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't16-diagonal', lineClassName: 't16-diagonal-words' }));
          if (normalized === 3) return wrap('t16-b3', wbwMarkup(full, 'wbw-slide', 'imp-bold', { motion: 't16-impact', lineClassName: 't16-impact-words' }));
          return wrap('t16-b0', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't16-stack', lineClassName: 't16-stack-words' }));
        case 't17':
          if (normalized === 1) return wrap('t17-b1', wbwMarkup(full, 'wbw-rise', 'imp-rose'));
          if (normalized === 2) return wrap('t17-b2', wbwMarkup(full, 'wbw-slide', 'imp-rose'));
          if (normalized === 3) return wrap('t17-b3', wbwMarkup(full, 'wbw-rise', 'imp-rose'));
          return wrap('t17-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose'));
        case 't18':
          if (normalized === 1) return wrap('t18-b1', \`<span class="reveal-txt lekha-template-fit">\${heroMarkup(full, 'imp-purple')}</span>\`);
          if (normalized === 2) return wrap('t18-b2', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          if (normalized === 3) return wrap('t18-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          return wrap('t18-b0', \`<span class="split-title lekha-template-fit"><span class="split-top">\${escapeHtml(resolvedPreviewLines[0] || full)}</span><span class="split-bot">\${resolvedPreviewLines[1] ? heroMarkup(resolvedPreviewLines[1], 'imp-purple') : ''}</span></span>\`);
        case 't19':
          if (normalized === 1) return wrap('t19-b1', \`<span class="rise-unit lekha-template-fit">\${heroMarkup(upperFull, 'imp-rose')}</span>\`);
          if (normalized === 2) return wrap('t19-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t19-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose'));
          return wrap('t19-b0', \`<span class="slash-wrap lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't20':
          if (normalized === 1) return wrap('t20-b1', \`<span class="impact-txt lekha-template-fit">\${heroMarkup(full, 'imp-green')}</span>\`);
          if (normalized === 2) return wrap('t20-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t20-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-green'));
          return wrap('t20-b0', \`<span class="impact-slide lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't21':
          if (normalized === 1) return wrap('t21-b1', wbwMarkup(full, 'wbw-seq-fade', 'imp-space'));
          if (normalized === 2) return wrap('t21-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t21-b3', wbwMarkup(full, 'wbw-slide', 'imp-weight'));
          return wrap('t21-b0', wbwMarkup(full, 'editorial-line wbw-rise', ''));
        case 't22':
          if (normalized === 1) return wrap('t22-b1', \`<span class="wave-txt lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t22-b2', wbwMarkup(full, 'wbw-rise', 'imp-italic'));
          if (normalized === 3) return wrap('t22-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
          return wrap('t22-b0', karaokeMarkup(full));
        case 't23':
          if (normalized === 3) return wrap('t23-b3', \`<span class="punch-txt lekha-template-fit">\${heroMarkup(full, 'imp-bold')}</span>\`);
          return wrap(\`t23-b\${normalized}\`, \`<span class="\${normalized === 0 ? 'setup-txt ' : ''}lekha-template-fit">\${escapeHtml(full)}</span>\`);
        case 't24':
          if (normalized === 1) return wrap('t24-b1', wbwMarkup(full, 'wbw-rise', 'imp-orange', { motion: 't24-drift', lineClassName: 't24-drift-line', compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 2) return wrap('t24-b2', wbwMarkup(full, 'wbw-slide', 'imp-orange', { motion: 't24-slide', lineClassName: 't24-slide-line', compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 3) return wrap('t24-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple', { motion: 't24-stamp', lineClassName: 't24-stamp-line', compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 4) return wrap('t24-b4', wbwMarkup(full, 'wbw-rise', 'imp-orange', { motion: 't24-inner', lineClassName: 't24-inner-line', compactLines: true, lineTexts: previewLineTexts }));
          return wrap('t24-b0', wbwMarkup(full, 'wbw-rise', 'imp-orange', { motion: 't24-wipe', lineClassName: 't24-wipe-line', compactLines: true, lineTexts: previewLineTexts }));
        case 't25':
          if (normalized === 1) return wrap('t25-b1', \`<span class="soft-rise lekha-template-fit lekha-template-preview-lines">\${compactLines2.map((line, index) => \`<span class="lekha-template-preview-line">\${index === compactLines2.length - 1 ? heroMarkup(line, 'imp-italic') : escapeHtml(line)}</span>\`).join('')}</span>\`);
          if (normalized === 2) return wrap('t25-b2', wbwMarkup(full, 'wbw-rise', 'imp-rose', { compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 3) return wrap('t25-b3', wbwMarkup(full, 'wbw-slide', 'imp-italic', { compactLines: true, lineTexts: previewLineTexts }));
          return wrap('t25-b0', \`<span class="hand-txt lekha-template-fit lekha-template-preview-lines">\${compactLines2.map((line, index) => \`<span class="lekha-template-preview-line">\${index === compactLines2.length - 1 ? heroMarkup(line, 'imp-rose') : escapeHtml(line)}</span>\`).join('')}</span>\`);
        case 't26':
          if (normalized === 1) return wrap('t26-b1', wbwMarkup(upperFull, 'wbw-slide', 'imp-rose', { motion: 't26-snap', lineClassName: 't26-snap-line' }));
          if (normalized === 2) return wrap('t26-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold', { motion: 't26-kick', lineClassName: 't26-kick-line' }));
          if (normalized === 3) return wrap('t26-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose', { motion: 't26-tag', lineClassName: 't26-tag-line' }));
          return wrap('t26-b0', wbwMarkup(upperFull, 'wbw-rise', 'imp-rose', { motion: 't26-shutter', lineClassName: 't26-shutter-line' }));
        case 't27':
          if (normalized === 1) return wrap('t27-b1', \`<span class="lekha-template-fit" style="font-family:'Exo 2',sans-serif;font-weight:700;color:rgba(0,229,255,0.8)">\${escapeHtml(full)}</span>\`);
          if (normalized === 2) return wrap('t27-b2', \`<span class="lekha-template-fit">\${heroMarkup(full, 'imp-bold')}</span>\`);
          if (normalized === 3) return wrap('t27-b3', wbwMarkup(full, 'wbw-rise', 'imp-cyan'));
          return wrap('t27-b0', \`<span class="center-expand-txt lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't28':
          if (normalized === 1) return wrap('t28-b1', \`<span class="slow-fade lekha-template-fit">\${heroMarkup(full, 'imp-gold')}</span>\`);
          if (normalized === 2) return wrap('t28-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t28-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
          return wrap('t28-b0', \`<span class="grain-txt lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br>\${heroMarkup(lines2[1], 'imp-gold')}\` : ''}</span>\`);
        case 't29':
          if (normalized === 1) return wrap('t29-b1', wbwMarkup(full, 'wbw-rise', 'imp-rose', { motion: 't29-recoil', lineClassName: 't29-recoil-line' }));
          if (normalized === 2) return wrap('t29-b2', wbwMarkup(full, 'wbw-slide', 'imp-rose', { motion: 't29-charge', lineClassName: 't29-charge-line' }));
          if (normalized === 3) return wrap('t29-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-rose', { motion: 't29-clamp', lineClassName: 't29-clamp-line' }));
          return wrap('t29-b0', wbwMarkup(full, 'wbw-rise', 'imp-rose', { motion: 't29-shutter', lineClassName: 't29-shutter-line' }));
        case 't30':
          if (normalized > 0) return wrap(\`t30-b\${normalized}\`, \`<span class="lekha-template-fit">\${normalized === 3 ? heroMarkup(full, 'imp-italic') : escapeHtml(full)}</span>\`);
          return wrap('t30-b0', \`<span class="breathe-txt lekha-template-fit">\${escapeHtml(lines2[0] || '')}\${lines2[1] ? \`<br><span class="imp-italic">\${escapeHtml(lines2[1])}</span>\` : ''}</span>\`);
        case 't31':
          if (normalized === 1) return wrap('t31-b1', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
          if (normalized === 2) return wrap('t31-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t31-b3', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 4) return wrap('t31-b4', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Playfair Display',serif">\${heroMarkup(full, 'imp-gold')}</span></span>\`);
          return wrap('t31-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-gold'));
        case 't32':
          if (normalized === 1) return wrap('t32-b1', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Bodoni Moda',serif;font-style:italic">\${heroMarkup(full, 'imp-italic')}</span></span>\`);
          if (normalized === 2) return wrap('t32-b2', \`<span class="lekha-template-fit">\${escapeHtml(full)}</span>\`);
          if (normalized === 3) return wrap('t32-b3', wbwMarkup(full, 'wbw-rise', 'imp-purple'));
          if (normalized === 4) return wrap('t32-b4', wbwMarkup(full, 'wbw-seq-fade', 'imp-purple'));
          return wrap('t32-b0', \`<span style="font-style:italic" class="lekha-template-fit">\${lineSpans(lines2, 'ink-line', (line, index) => index === lines2.length - 1 ? heroMarkup(line, 'imp-purple') : escapeHtml(line))}</span>\`);
        case 't33':
          if (normalized === 1) return wrap('t33-b1', wbwMarkup(full, 'wbw-seq-fade', 'imp-cyan', { compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 2) return wrap('t33-b2', karaokeMarkup(full));
          if (normalized === 3) return wrap('t33-b3', wbwMarkup(full, 'wbw-rise', 'imp-bold', { compactLines: true, lineTexts: previewLineTexts }));
          if (normalized === 4) return wrap('t33-b4', \`<span style="perspective:500px" class="lekha-template-fit"><span class="flip-line" style="font-family:'Noto Sans',sans-serif">\${heroMarkup(full, 'imp-cyan')}</span></span>\`);
          return wrap('t33-b0', \`<span class="doc-line lekha-template-fit">\${lineSpans(resolvedPreviewLines, '', (line) => line.includes(hero) ? heroMarkup(line, 'imp-cyan') : escapeHtml(line))}</span>\`);
        case 't34':
          if (normalized === 1) return wrap('t34-b1', \`<span class="pow-txt lekha-template-fit">\${heroMarkup(full, 'imp-cyan')}</span>\`);
          if (normalized === 2) return wrap('t34-b2', wbwMarkup(full, 'wbw-rise', 'imp-bold'));
          if (normalized === 3) return wrap('t34-b3', wbwMarkup(full, 'wbw-slide', 'imp-cyan'));
          return wrap('t34-b0', wbwMarkup(full, 'wbw-seq-fade', 'imp-bold'));
        case 't35':
          if (normalized > 0) return wrap(\`t35-b\${normalized}\`, \`<span class="lekha-template-fit">\${normalized === 3 ? heroMarkup(full, 'imp-italic') : escapeHtml(full)}</span>\`);
          return wrap('t35-b0', \`<span class="secret-txt lekha-template-fit">\${heroMarkup(full, 'imp-italic')}</span>\`);
        case 't36':
          return wrap(\`t36-b\${normalized}\`, karaokeMarkup(full));
        case 't37':
          if (normalized === 1) return wrap('t37-b1', wbwMarkup(full, 'wbw-rise', 'imp-green'));
          if (normalized === 2) return wrap('t37-b2', \`<span class="neon-expand lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
          if (normalized === 3) return wrap('t37-b3', wbwMarkup(full, 'wbw-seq', 'imp-green'));
          return wrap('t37-b0', \`<span class="neon-pulse lekha-template-fit">\${escapeHtml(upperFull)}</span>\`);
        case 't38':
          if (normalized === 1) return wrap('t38-b1', wbwMarkup(full, 'wbw-slide', 'imp-italic'));
          if (normalized === 2) return wrap('t38-b2', wbwMarkup(full, 'wbw-rise', 'imp-gold'));
          if (normalized === 3) return wrap('t38-b3', wbwMarkup(full, 'wbw-seq-fade', 'imp-italic'));
          return wrap('t38-b0', \`<span class="lekha-template-fit lekha-template-preview-lines">\${resolvedPreviewLines.map((line) => escapeHtml(line)).join('<br>')}</span>\`);
        case 't39':
          return wrap(\`t39-b\${normalized}\`, wbwMarkup(full, 'wbw-seq-fade', normalized % 2 ? 'imp-rose' : 'imp-gold', { motion: 't39-evidence' }));
        case 't40':
          if (normalized === 2) return wrap('t40-b2', \`<span class="lekha-template-fit">\${stillFramesMarkup(full)}</span>\`);
          return wrap(\`t40-b\${normalized}\`, \`<span class="lekha-template-fit">\${stillFramesMarkup(full)}</span>\`);
        case 't41':
        case 't42':
        case 't43':
        case 't44':
        case 't45':
        case 't46':
        case 't47':
        case 't48':
        case 't49':
        case 't50':
        case 't51':
        case 't52': {
          const keyframeLine = wbwMarkup(
            full,
            (blockType === 'styled' ? 'wbw-seq' : blockType) + ' ' + templateId + '-line',
            'imp-' + templateId,
          ).replace(/ in" data-i=/g, '" data-i=');
          const keyframeInner = templateId === 't44'
            ? '<span class="t44-thread ' + (normalized % 2 ? 't44-me' : 't44-them') + '">'
              + '<span class="t44-typing" aria-hidden="true"><span class="t44-dot"></span><span class="t44-dot"></span><span class="t44-dot"></span></span>'
              + keyframeLine + '</span>'
            : keyframeLine;
          return wrap(templateId + '-b' + normalized, keyframeInner);
        }
        default:
          return '';
      }
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

    // Displacing a word authors a CPT. The editor keeps every word visible;
    // playback/export reveals the final static positions cumulatively.
    const captionHasCptWords = (caption) => (
      Object.values(caption?.word_styles || {}).some((wordStyle = {}) => (
        Math.abs(Number(wordStyle?.abs_x_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.abs_y_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.x_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.y_pct) || 0) > 0.01
        || Math.abs(Number(wordStyle?.x) || 0) > 0.01
        || Math.abs(Number(wordStyle?.y) || 0) > 0.01
      ))
    );

    const hasAbsoluteWordPosition = (wordStyle = {}) => (
      Number.isFinite(Number(wordStyle.abs_x_pct))
      && Number.isFinite(Number(wordStyle.abs_y_pct))
      && (
        Math.abs(Number(wordStyle.abs_x_pct)) > 0.01
        || Math.abs(Number(wordStyle.abs_y_pct)) > 0.01
      )
    );

    // ExportPanel expands a canvas CPT into one absolute entry per word. Once
    // that complete composition exists, render it directly instead of feeding
    // it back through the source template's sentence-flow markup.
    const captionHasAbsoluteCptLayout = (caption) => {
      const words = String(caption?.text || '').trim().split(/\s+/).filter(Boolean);
      if (!words.length || !captionHasCptWords(caption)) return false;
      return words.every((_, index) => (
        hasAbsoluteWordPosition(caption?.word_styles?.[String(caption.id) + '-' + index] || {})
      ));
    };

    const getWordEffectInlineStyles = (wordStyle = {}) => {
      const type = wordStyle?.effectType || 'none';
      if (type === 'none') return {};
      const color = wordStyle?.effectColor || '#000000';
      const blur = ((wordStyle?.effectBlur ?? 50) / 100) * 24;
      const offset = ((wordStyle?.effectOffset ?? 50) / 100) * 16;
      const dir = wordStyle?.effectDirection ?? -45;
      const transp = wordStyle?.effectTransparency ?? 40;
      const thick = wordStyle?.effectThickness ?? 50;
      const alpha = (100 - transp) / 100;
      const rad = (dir * Math.PI) / 180;
      const ox = +(Math.cos(rad) * offset).toFixed(1);
      const oy = +(Math.sin(rad) * offset).toFixed(1);
      const rc = (a = alpha) => rgbaFromHex(color, a);
      switch (type) {
        case 'shadow': return { 'text-shadow': \`\${ox}px \${oy}px \${blur}px \${rc()}\` };
        case 'lift': return { 'text-shadow': \`0px \${(offset * 0.4).toFixed(1)}px \${(blur * 0.5).toFixed(1)}px \${rc()}, 0px \${offset}px \${blur}px \${rc(alpha * 0.4)}\` };
        case 'hollow': return { '-webkit-text-stroke': \`\${(thick / 40).toFixed(1)}px \${color}\`, color: 'transparent', '-webkit-text-fill-color': 'transparent' };
        case 'splice': return { 'text-shadow': \`\${ox}px \${oy}px 0px \${rc()}\` };
        case 'outline': return { '-webkit-text-stroke': \`\${(thick / 40).toFixed(1)}px \${color}\` };
        case 'echo': return { 'text-shadow': \`\${ox}px \${oy}px 0px \${rc()}, \${ox * 2}px \${oy * 2}px 0px \${rc(alpha * 0.55)}, \${ox * 3}px \${oy * 3}px 0px \${rc(alpha * 0.25)}\` };
        case 'neon': return { 'text-shadow': \`0 0 \${(blur * 0.5).toFixed(1)}px \${color}, 0 0 \${blur}px \${color}, 0 0 \${(blur * 2).toFixed(1)}px \${color}\` };
        default: return {};
      }
    };

    const getCaptionEffectInlineStyles = (style = {}) => getWordEffectInlineStyles({
      effectType: style.effect_type,
      effectColor: style.effect_color,
      effectBlur: style.effect_blur,
      effectOffset: style.effect_offset,
      effectDirection: style.effect_direction,
      effectTransparency: style.effect_transparency,
      effectThickness: style.effect_thickness,
    });

    const inlineStyleObject = (styles = {}) => Object.entries(styles)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([property, value]) => \`\${property}:\${value}\`)
      .join(';');

    const getSourceWordAnimationStyle = (animationType, speed = 1) => {
      const safeSpeed = Math.max(0.25, Number(speed) || 1);
      const duration = (seconds) => \`\${+(seconds / safeSpeed).toFixed(2)}s\`;
      const animations = {
        rise: \`source-word-rise \${duration(0.4)} ease-out both\`,
        pan: \`source-word-pan \${duration(0.5)} ease-in-out both\`,
        fade: \`source-word-fade \${duration(0.5)} ease-in both\`,
        pop: \`source-word-pop \${duration(0.3)} ease-out both\`,
        wipe: \`source-word-wipe \${duration(0.4)} ease-out both\`,
        blur: \`source-word-blur \${duration(0.5)} ease-in-out both\`,
        succession: \`source-word-succession \${duration(0.4)} ease-out both\`,
        breathe: \`source-word-breathe \${duration(1.5)} ease-in-out infinite\`,
        baseline: \`source-word-baseline \${duration(0.4)} ease-out both\`,
        drift: \`source-word-drift \${duration(0.6)} ease-in-out both\`,
        tectonic: \`source-word-tectonic \${duration(0.5)} ease-out both\`,
        tumble: \`source-word-tumble \${duration(0.6)} ease-in-out both\`,
      };
      return animations[animationType] || '';
    };

    const sourceTemplateWordSelector = [
      '.lekha-applied-basic-template-host .word',
      '.lekha-applied-basic-template-host .w',
      '.lekha-applied-basic-template-host .wbw-word',
      '.template-caption-shell .lekha-original-template .w',
      '.template-caption-shell .lekha-original-template .kf-word',
      '.template-caption-shell .lekha-original-template .is-emphasis',
      '.lekha-sidebar-export-template-shell .w',
      '.lekha-sidebar-export-template-shell .wbw-word',
      '.lekha-sidebar-export-template-shell .sw',
      '.lekha-sidebar-export-template-shell .sw-w',
      '.lekha-sidebar-export-template-shell .plain-word',
      '[data-word-key]',
      '[data-w]',
      '[data-i]',
    ].join(',');

    const getEditableSourceTemplateWords = (root) => {
      const blocks = Array.from(root.querySelectorAll('.sb, .sblock, .lekha-applied-advanced-template'));
      const scopes = blocks.length ? blocks : [root];
      const seenNodes = new Set();
      const editableWords = [];
      scopes.forEach((scope) => {
        Array.from(scope.querySelectorAll(sourceTemplateWordSelector)).forEach((node) => {
          if (seenNodes.has(node)) return;
          if (node.closest?.('[data-source-word-spacer="true"]')) return;
          const parentEditable = node.parentElement?.closest?.(sourceTemplateWordSelector);
          if (parentEditable && scope.contains(parentEditable)) return;
          seenNodes.add(node);
          const explicitIndex = Number(node.dataset?.w ?? node.dataset?.i);
          editableWords.push({
            node,
            index: Number.isFinite(explicitIndex) ? explicitIndex : editableWords.length,
          });
        });
      });
      return editableWords
        .filter(({ index }) => Number.isFinite(index) && index >= 0)
        .sort((left, right) => left.index - right.index);
    };

    const sourceTemplateVisualSelector = '[data-source-word-visual="true"], .kf-base, .kf-fill';
    const getSourceTemplateVisualTargets = (node) => {
      if (!node) return [];
      const existingTargets = Array.from(node.querySelectorAll(sourceTemplateVisualSelector));
      if (existingTargets.length) return existingTargets;
      const elementChildren = Array.from(node.children || []);
      if (elementChildren.length) return [node];
      const visual = document.createElement('span');
      visual.dataset.sourceWordVisual = 'true';
      while (node.firstChild) {
        visual.appendChild(node.firstChild);
      }
      node.appendChild(visual);
      return [visual];
    };

    // CSS transforms do not apply to non-replaced inline boxes. The managed
    // visual span this renderer wraps a word in is inline by default, so a
    // dragged word (CPT) received the correct translate value and still never
    // moved in the exported video — the preview escapes this because
    // prepareSourceTemplateWordNode() forces inline-block there. Upgrade the
    // box only when an offset is actually being applied, so words that merely
    // carry font/colour overrides keep their current export layout.
    const ensureTransformableWordTarget = (element) => {
      if (!element?.style) return;
      if (getComputedStyle(element).display !== 'inline') return;
      element.style.setProperty('display', 'inline-block', 'important');
      element.style.setProperty('transform-origin', 'center center', 'important');
      element.style.setProperty('white-space', 'nowrap', 'important');
      element.style.setProperty('overflow', 'visible', 'important');
      element.style.setProperty('vertical-align', 'baseline', 'important');
      element.style.setProperty('line-height', 'inherit', 'important');
    };

    const applySourceTemplateWordStyles = (root, caption, renderTime = 0) => {
      if (!root || !caption) return;
      const nodes = getEditableSourceTemplateWords(root);
      const styles = caption.word_styles || {};
      const isCptCaption = captionHasCptWords(caption);
      const currentCptIndex = getCurrentWordIndex(caption, renderTime);
      const hasRealAbsolutePosition = (wordStyle = {}) => (
        Number.isFinite(Number(wordStyle.abs_x_pct))
        && Number.isFinite(Number(wordStyle.abs_y_pct))
        && (
          Math.abs(Number(wordStyle.abs_x_pct)) > 0.01
          || Math.abs(Number(wordStyle.abs_y_pct)) > 0.01
        )
      );
      const setImportant = (element, property, value) => {
        if (!element?.style || value === undefined || value === null || value === '') return;
        element.style.setProperty(property, String(value), 'important');
      };
      const unlockPositionedWordOverflow = (element) => {
        let current = element;
        while (current && root.contains(current)) {
          setImportant(current, 'overflow', 'visible');
          setImportant(current, 'overflow-x', 'visible');
          setImportant(current, 'overflow-y', 'visible');
          setImportant(current, 'clip-path', 'none');
          setImportant(current, '-webkit-clip-path', 'none');
          setImportant(current, 'mask-image', 'none');
          setImportant(current, '-webkit-mask-image', 'none');
          setImportant(current, 'contain', 'none');
          if (current === root) break;
          current = current.parentElement;
        }
      };
      const applyTextGradient = (target, gradient) => {
        setImportant(target, 'background-color', 'transparent');
        setImportant(target, 'background', gradient);
        setImportant(target, 'background-image', gradient);
        setImportant(target, 'background-size', '100% 100%');
        setImportant(target, 'background-repeat', 'no-repeat');
        setImportant(target, 'background-position', 'center');
        setImportant(target, '-webkit-background-clip', 'text');
        setImportant(target, 'background-clip', 'text');
        setImportant(target, '-webkit-text-fill-color', 'transparent');
        setImportant(target, 'color', 'transparent');
      };
      nodes.forEach(({ node, index }) => {
        const key = \`\${caption.id}-\${index}\`;
        const wordStyle = styles[key] || {};
        node.dataset.wordKey = key;
        if (isCptCaption && index > currentCptIndex) {
          setImportant(node, 'opacity', '0');
        } else if (isCptCaption) {
          setImportant(node, 'opacity', '1');
        }
        if (!Object.keys(wordStyle).length && !isCptCaption) return;
        const targets = getSourceTemplateVisualTargets(node);
        if (isCptCaption) {
          // CPT words appear immediately in the exact final canvas state. Kill
          // authored template, caption, and per-word entrance motion on both the
          // editable anchor and its generated visual wrapper without changing
          // the word's visibility.
          [node, ...targets].forEach((target) => {
            setImportant(target, 'animation', 'none');
            setImportant(target, 'animation-delay', '0s');
            setImportant(target, 'animation-play-state', 'paused');
            setImportant(target, 'transition', 'none');
            setImportant(target, 'transform', 'none');
            setImportant(target, 'clip-path', 'none');
            setImportant(target, '-webkit-clip-path', 'none');
            setImportant(target, 'filter', 'none');
            delete target.dataset.cptWordStart;
            delete target.dataset.cptWordMotion;
          });
        }
        const isPlainEditorLayer = Boolean(node.closest('.plain-caption-shell, .text-element-shell'));
        const positionTargets = isPlainEditorLayer ? [node] : targets;
        const hasSourceXPct = wordStyle.x_pct !== null
          && wordStyle.x_pct !== ''
          && Number.isFinite(Number(wordStyle.x_pct));
        const hasSourceYPct = wordStyle.y_pct !== null
          && wordStyle.y_pct !== ''
          && Number.isFinite(Number(wordStyle.y_pct));
        const sourceOffsetX = hasSourceXPct
          ? (Number(wordStyle.x_pct) / 100) * window.innerWidth
          : Number(wordStyle.x || 0) * (window.__exportCanvasScale || 1);
        const sourceOffsetY = hasSourceYPct
          ? (Number(wordStyle.y_pct) / 100) * window.innerHeight
          : Number(wordStyle.y || 0) * (window.__exportCanvasScale || 1);
        let absoluteWordPosition = null;
        if (hasRealAbsolutePosition(wordStyle)) {
          if (node.dataset.exportAbsoluteWordPositioned === 'true') {
            positionTargets.forEach((target) => target.style.removeProperty('translate'));
          }
          absoluteWordPosition = {
            x: (Number(wordStyle.abs_x_pct) / 100) * window.innerWidth,
            y: (Number(wordStyle.abs_y_pct) / 100) * window.innerHeight,
          };
          node.dataset.exportAbsoluteWordPositioned = 'true';
        }
        if (absoluteWordPosition) {
          unlockPositionedWordOverflow(node);
          const rotation = Number(wordStyle.rotation || 0) || 0;
          const scaleX = Number(wordStyle.textScaleX || 1) || 1;
          setImportant(node, 'z-index', '80');
          positionTargets.forEach((target) => {
            target.dataset.exportWordPositionTarget = 'true';
            ensureTransformableWordTarget(target);
            const targetRect = target.getBoundingClientRect();
            const targetOffsetX = absoluteWordPosition.x - (targetRect.left + targetRect.width / 2);
            const targetOffsetY = absoluteWordPosition.y - (targetRect.top + targetRect.height / 2);
            setImportant(
              target,
              'translate',
              \`\${Math.round(targetOffsetX)}px \${Math.round(targetOffsetY)}px\`,
            );
            if (rotation) setImportant(target, 'rotate', \`\${rotation}deg\`);
            if (Math.abs(scaleX - 1) > 0.001) setImportant(target, 'scale', \`\${scaleX} 1\`);
          });
        } else if (Math.abs(sourceOffsetX) > 0.01 || Math.abs(sourceOffsetY) > 0.01) {
          unlockPositionedWordOverflow(node);
          positionTargets.forEach((target) => {
            target.dataset.exportWordPositionTarget = 'true';
            ensureTransformableWordTarget(target);
            setImportant(
              target,
              'translate',
              \`\${Math.round(sourceOffsetX)}px \${Math.round(sourceOffsetY)}px\`,
            );
          });
        }
        if (isPlainEditorLayer && wordStyle.boxWidth) {
          setImportant(node, 'width', \`\${scaleExportPx(wordStyle.boxWidth)}px\`);
          setImportant(node, 'white-space', 'normal');
          setImportant(node, 'overflow-wrap', 'anywhere');
        }
        const textGradient = typeof wordStyle.textGradient === 'string' ? wordStyle.textGradient.trim() : '';
        if (textGradient) {
          node.dataset.sourceWordGradient = 'true';
          node.style.setProperty('--source-word-text-gradient', textGradient, 'important');
        } else {
          delete node.dataset.sourceWordGradient;
          node.style.removeProperty('--source-word-text-gradient');
        }
        targets.forEach((target) => {
          if (wordStyle.fontFamily) setImportant(target, 'font-family', wordStyle.fontFamily);
          if (wordStyle.fontSize) {
            const scaledFontSize = isPlainEditorLayer
              ? scaleExportPx(wordStyle.fontSize)
              : scaleTemplateFontSize(wordStyle.fontSize);
            setImportant(target, 'font-size', \`\${scaledFontSize}px\`);
          }
          if (wordStyle.fontWeight) setImportant(target, 'font-weight', wordStyle.fontWeight);
          if (wordStyle.fontStyle) setImportant(target, 'font-style', wordStyle.fontStyle);
          if (wordStyle.textDecoration) setImportant(target, 'text-decoration', wordStyle.textDecoration);
          if (wordStyle.textTransform) setImportant(target, 'text-transform', wordStyle.textTransform);
          if (wordStyle.isEmphasis) {
            const emphasisColor = caption.custom_style?.highlight_color
              || caption.custom_style?.text_color
              || caption.applied_template_style?.highlight_color
              || caption.applied_template_style?.emphasis_color
              || caption.applied_template_style?.secondary_color
              || caption.emphasis_color
              || '#DDAA03';
            if (!wordStyle.fontWeight) setImportant(target, 'font-weight', '700');
            if (!wordStyle.fontSize) setImportant(target, 'scale', '1.12');
            if (!wordStyle.color && !textGradient) {
              setImportant(target, 'color', emphasisColor);
              setImportant(target, '-webkit-text-fill-color', emphasisColor);
            }
            setImportant(target, 'text-shadow', \`0 0 18px \${emphasisColor}99, 0 0 6px \${emphasisColor}66\`);
          }
          if (textGradient) {
            applyTextGradient(target, textGradient);
          } else if (wordStyle.color) {
            setImportant(target, 'color', wordStyle.color);
            setImportant(target, '-webkit-text-fill-color', wordStyle.color);
          }
          if (wordStyle.backgroundColor || wordStyle.highlightGradient) {
            setImportant(target, 'background', wordStyle.highlightGradient || rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6));
            setImportant(target, 'border-radius', '4px');
            setImportant(target, 'padding', \`\${wordStyle.backgroundPadding || 2}px 4px\`);
            setImportant(target, 'box-decoration-break', 'clone');
            setImportant(target, '-webkit-box-decoration-break', 'clone');
            if (textGradient) applyTextGradient(target, textGradient);
          }
          Object.entries(getWordEffectInlineStyles(wordStyle)).forEach(([property, value]) => {
            setImportant(target, property, value);
          });
          const animation = isCptCaption
            ? ''
            : getSourceWordAnimationStyle(wordStyle.animation, wordStyle.animationSpeed || 1);
          if (animation) {
            setImportant(target, 'display', 'inline-block');
            setImportant(target, 'transform-origin', 'center center');
            setImportant(target, 'animation', animation);
          }
        });
      });
    };

    // Right-side "Basic" templates — render the authored .btcard source markup
    // (with the caption's words injected at the active phase) exactly like the
    // canvas preview. The shared builder (window.__basicTpl) and per-template
    // markup (window.__basicTemplateMarkupMap) are injected before this script.
    const buildBasicTemplateCaptionMarkup = (caption, globalStyle, time) => {
      const templateId = String(globalStyle?.template_id || '').trim();
      const rawMarkup = (window.__basicTemplateMarkupMap || {})[templateId] || '';
      const text = String(caption?.text || '').trim();
      if (!rawMarkup || !text || !window.__basicTpl) {
        return buildTemplateMarkup(caption, globalStyle, time);
      }
      const words = text.split(/\\s+/).filter(Boolean);
      const phaseCount = window.__basicTpl.countAppliedBasicTemplatePhasesFromMarkup(rawMarkup);
      const templateCaptionIndex = Number.isFinite(Number(caption.__templateIndex))
        ? Number(caption.__templateIndex)
        : 0;
      const selectedPhase = ((templateCaptionIndex % phaseCount) + phaseCount) % phaseCount;
      const currentIndex = window.__basicTpl.getAppliedBasicCurrentWordIndex
        ? window.__basicTpl.getAppliedBasicCurrentWordIndex(caption, time, words.length)
        : getCurrentWordIndex(caption, time);
      const impWordIndex = Number(
        caption?.imp_word_index
        ?? caption?.template_imp_word_index
        ?? caption?.emphasis_word_index
        ?? -1,
      );
      const impWordIndices = Array.isArray(caption?.imp_word_indices)
        ? caption.imp_word_indices
        : [];
      const html = window.__basicTpl.buildAppliedBasicTemplateInlineFromMarkup(
        rawMarkup,
        templateId,
        text,
        { activePhase: selectedPhase, currentIndex: 0, impWordIndex, impWordIndices },
      );
      if (!html) return buildTemplateMarkup(caption, globalStyle, time);
      const textCase = globalStyle?.text_case && globalStyle.text_case !== 'none'
        ? globalStyle.text_case
        : '';
      const normalizedTemplateFontSize = normalizeAppliedBasicTemplateFontSize(
        templateId,
        globalStyle?.font_size || 22,
      ) || 22;
      const exportScale = Number(window.__exportCanvasScale || 1) || 1;
      const measuredBasicWidth = Number(
        caption?.preview_template_box_width_px
        || caption?.applied_template_style?.preview_template_box_width_px
        || globalStyle?.preview_template_box_width_px
        || 0,
      );
      const measuredBasicFont = Number(
        caption?.preview_template_font_px
        || caption?.applied_template_style?.preview_template_font_px
        || globalStyle?.preview_template_font_px
        || 0,
      );
      const exportBasicWidth = Math.max(
        1,
        Math.round((measuredBasicWidth > 0 ? measuredBasicWidth : 320) * exportScale),
      );
      const exportBasicFontPx = measuredBasicFont > 0
        ? Math.max(1, Math.round(measuredBasicFont * exportScale))
        : Math.max(
            12,
            Math.round(scaleTemplateFontSize(normalizedTemplateFontSize) * APPLIED_BASIC_EXPORT_FONT_SCALE),
          );
      const hostStyle = [
        \`--template-primary:\${globalStyle?.text_color || '#ffffff'}\`,
        \`--template-text-gradient:\${globalStyle?.text_gradient || 'none'}\`,
        \`--template-secondary:\${globalStyle?.secondary_color || '#000000'}\`,
        \`--template-bg:\${globalStyle?.background_color || 'transparent'}\`,
        \`--template-highlight:\${globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-highlight-gradient:\${globalStyle?.highlight_gradient || 'none'}\`,
        \`--template-karaoke-1:\${globalStyle?.karaoke_color_1 || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-karaoke-2:\${globalStyle?.karaoke_color_2 || '#22D3EE'}\`,
        \`--template-karaoke-3:\${globalStyle?.karaoke_color_3 || '#FB923C'}\`,
        \`--applied-basic-scale:\${exportScale}\`,
        \`--applied-basic-width:\${exportBasicWidth}px\`,
        \`color:\${globalStyle?.text_color || '#ffffff'}\`,
        \`font-family:'\${globalStyle?.font_family || 'Inter'}'\`,
        \`font-size:\${exportBasicFontPx}px\`,
        \`font-weight:\${globalStyle?.font_weight || '800'}\`,
        \`font-style:\${globalStyle?.font_style || 'normal'}\`,
        \`line-height:\${globalStyle?.line_spacing || 1.25}\`,
        textCase ? \`text-transform:\${textCase}\` : '',
      ].filter(Boolean).join(';');
      return \`<span class="lekha-applied-basic-template-host lekha-basic-template-fit lekha-basic-template-enter-once \${templateId} \${globalStyle?.text_gradient ? 'has-text-gradient' : ''} \${globalStyle?.highlight_gradient ? 'has-highlight-gradient' : ''}" \`
        + \`data-applied-template-id="\${templateId}" data-applied-template-source="lekha-basic" \`
        + \`data-export-measure="basic-template" data-export-caption-id="\${escapeHtml(caption?.id || '')}" \`
        + \`data-caption-start="\${Number(caption?.start_time ?? 0)}" data-caption-end="\${Number(caption?.end_time ?? caption?.start_time ?? 0)}" \`
        + \`data-basic-current-index="\${currentIndex}" data-basic-word-count="\${words.length}" \`
        + \`style="\${hostStyle}">\${html}</span>\`;
    };

    const activateBasicTemplates = (root) => {
      if (!window.__basicTpl || !window.__basicTpl.updateAppliedBasicTemplateWordState) return;
      root.querySelectorAll('.lekha-applied-basic-template-host').forEach((host) => {
        const currentIndex = Number(host.getAttribute('data-basic-current-index')) || 0;
        const wordCount = Number(host.getAttribute('data-basic-word-count')) || 1;
        const templateId = host.getAttribute('data-applied-template-id') || '';
        window.__basicTpl.updateAppliedBasicTemplateWordState(host, currentIndex, wordCount, templateId);
      });
    };

    const buildTemplateMarkup = (caption, globalStyle, time) => {
      const templateIndex = /^t\\d{2}$/.test(String(globalStyle?.template_id || ''))
        ? resolveAdvancedTemplatePhaseIndex(caption, caption.__templateIndex ?? caption.__template_index ?? 0)
        : Number.isFinite(Number(caption.__templateIndex))
          ? Number(caption.__templateIndex)
          : Number(caption.__template_index || 0);
      const words = buildWordMeta(caption);
      const captionStart = Number(caption.start_time ?? 0);
      const captionEnd = Number(caption.end_time ?? captionStart);
      const captionDuration = Math.max(captionEnd - captionStart, 0.01);
      const elapsed = Math.min(Math.max(time - captionStart, 0), captionDuration);
      const currentIndex = words.length > 1
        ? Math.max(0, Math.min(words.length - 1, Math.floor((elapsed / captionDuration) * words.length)))
        : 0;
      const showInactive = globalStyle?.show_inactive !== false;
      const wordSpacing = \`\${scaleExportPx((globalStyle?.word_spacing ?? 1) * 2)}px\`;
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
          if (captionHasCptWords(caption) && index > currentIndex) inline.push('opacity:0');
          if (wordStyle.color) inline.push(\`color:\${wordStyle.color}\`);
          if (wordStyle.fontFamily) inline.push(\`font-family:"\${wordStyle.fontFamily}"\`);
          if (wordStyle.fontSize) inline.push(\`font-size:\${scaleTemplateFontSize(wordStyle.fontSize)}px\`);
          if (wordStyle.fontWeight) inline.push(\`font-weight:\${wordStyle.fontWeight}\`);
          if (wordStyle.fontStyle) inline.push(\`font-style:\${wordStyle.fontStyle}\`);
          if (index < words.length - 1) inline.push(\`margin-right:\${wordSpacing}\`);

          return \`<span data-word-key="\${word.key}" class="\${className}" style="\${escapeHtml(inline.join(';'))}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
        })
        .filter(Boolean)
        .join('');

      const hasAppliedTemplate = Boolean(globalStyle?.template_id);
      const templatePrimaryColor = globalStyle?.template_id === 't36'
        ? '#ffffff'
        : (globalStyle?.text_color || '#ffffff');
      const styleVars = [
        \`--template-primary:\${templatePrimaryColor}\`,
        \`--template-text-gradient:\${globalStyle?.text_gradient || 'none'}\`,
        \`--template-secondary:\${globalStyle?.secondary_color || '#000000'}\`,
        \`--template-bg:\${hasAppliedTemplate ? 'transparent' : (globalStyle?.background_color || 'transparent')}\`,
        \`--template-highlight:\${globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-highlight-gradient:\${globalStyle?.highlight_gradient || 'none'}\`,
        \`--template-karaoke-1:\${globalStyle?.karaoke_color_1 || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '#DDAA03'}\`,
        \`--template-karaoke-2:\${globalStyle?.karaoke_color_2 || '#22D3EE'}\`,
        \`--template-karaoke-3:\${globalStyle?.karaoke_color_3 || '#FB923C'}\`,
      ];

      if (isAdvancedTemplate) {
        const previewLineTexts = Array.isArray(caption?.preview_template_line_texts)
          && caption.preview_template_line_texts.length > 0
          ? caption.preview_template_line_texts
          : globalStyle?.preview_template_line_texts;
        return \`
          <div
            class="template-caption-shell template-shell-\${globalStyle?.template_id || ''} \${globalStyle?.template_color_customized ? 'is-color-customized' : ''} \${globalStyle?.text_gradient ? 'has-text-gradient' : ''} \${globalStyle?.highlight_gradient ? 'has-highlight-gradient' : ''}"
            data-caption-start="\${captionStart}"
            data-caption-end="\${captionEnd}"
            style="\${styleVars.join(';')}"
          >
            <div class="\${globalStyle?.template_id || ''}">
        <span class="\${globalStyle?.template_id || ''}" style="
                font-family:'\${globalStyle?.font_family || 'Inter'}';
                font-weight:\${globalStyle?.font_weight || '500'};
                font-style:\${globalStyle?.font_style || 'normal'};
                text-align:\${globalStyle?.text_align || 'center'};
              ">\${buildCanonicalAdvancedTemplateMarkup(
                globalStyle?.template_id,
                transformText(caption.text || '', globalStyle),
                templateIndex,
                Number(caption.imp_word_index ?? -1),
                globalStyle?.template_color_customized
                  ? (caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || '')
                  : '',
                previewLineTexts,
                caption.imp_word_indices || [],
              ) || buildOriginalAdvancedTemplateMarkup(
                globalStyle?.template_id,
                transformText(caption.text || '', globalStyle),
                templateIndex,
                previewLineTexts,
                Number(caption.imp_word_index ?? -1),
                caption.imp_word_indices || [],
              )}</span>
            </div>
          </div>
        \`;
      }

      return \`
        <div class="template-caption-shell" style="\${styleVars.join(';')}">
          <div class="\${globalStyle?.template_id || ''}">
            <span class="\${wrapperClassName}" style="
              font-family:'\${globalStyle?.font_family || 'Inter'}';
              font-size:\${scaleTemplateFontSize(globalStyle?.font_size || 18)}px;
              font-weight:\${globalStyle?.font_weight || '500'};
              font-style:\${globalStyle?.font_style || 'normal'};
              text-align:\${globalStyle?.text_align || 'center'};
              letter-spacing:\${scaleExportPx(globalStyle?.letter_spacing || 0)}px;
            ">\${flowedWords}</span>
          </div>
        </div>
      \`;
    };

    const sanitizeSidebarInlineStyle = (styleValue = '') => {
      const allowed = String(styleValue)
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .filter((declaration) => {
          const parts = declaration.split(':');
          const property = String(parts.shift() || '').trim().toLowerCase();
          const value = parts.join(':').trim();
          if (property === 'animation-delay') return /^-?\\d*\\.?\\d+(m?s)$/i.test(value);
          if (/^--template-(?:primary|secondary|highlight|bg)$/.test(property)) {
            return /^(?:#[0-9a-f]{3,8}|transparent|rgba?\\([\\d\\s,%.]+\\))$/i.test(value);
          }
          return false;
        });
      return allowed.length ? ' style="' + allowed.join(';') + '"' : '';
    };

    const sanitizeSidebarTemplateMarkup = (markup = '', preserveInlineStyles = false) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(markup), 'text/html');
      const allowedTags = new Set([
        'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
        'small', 'mark', 'sub', 'sup',
      ]);
      const safeDataName = /^data-(?:anim|dur|type|imp|imp-cls|line-motion|line-delay|battle-motion|battle-index|lc-[a-z0-9-]+)$/i;

      for (const node of Array.from(doc.body.querySelectorAll('*'))) {
        if (!allowedTags.has(node.tagName.toLowerCase())) {
          node.remove();
          continue;
        }
        for (const attribute of Array.from(node.attributes)) {
          const name = attribute.name.toLowerCase();
          const value = String(attribute.value || '');
          if (name === 'class') {
            const cleanedClassValue = value
              .split(/\\s+/)
              .filter((className) => /^[A-Za-z0-9_-]{1,80}$/.test(className))
              .filter((className) => className && !['active', 'visible', 'anim', preserveInlineStyles ? '' : 'on', 'in'].includes(className))
              .join(' ');
            if (cleanedClassValue) node.setAttribute('class', cleanedClassValue);
            else node.removeAttribute(attribute.name);
            continue;
          }
          if (name === 'style') {
            node.removeAttribute(attribute.name);
            if (preserveInlineStyles) {
              const safeStyle = sanitizeSidebarInlineStyle(value).match(/ style="([^"]*)"/)?.[1] || '';
              if (safeStyle) node.setAttribute('style', safeStyle);
            }
            continue;
          }
          if (safeDataName.test(name) && value.length <= 240 && !/[<>]/.test(value)) {
            continue;
          }
          node.removeAttribute(attribute.name);
        }
      }
      return doc.body.innerHTML;
    };

    const cleanSidebarClassName = (value, fallback) => {
      const cleaned = String(value || '')
        .split(/\\s+/)
        .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in'].includes(className))
        .join(' ');
      return cleaned || fallback;
    };

    const mappedSidebarClassName = (sourceClasses, index, total, fallback) => {
      if (!sourceClasses.length) return fallback;
      if (total <= 1) return sourceClasses[0] || fallback;
      const sourceIndex = Math.min(
        sourceClasses.length - 1,
        Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1)),
      );
      return sourceClasses[sourceIndex] || fallback;
    };

    const mappedSidebarNodeValue = (sourceNodes, index, total, attrName, fallback = '') => (
      mappedSidebarClassName(
        sourceNodes.map((node) => node.getAttribute(attrName) || ''),
        index,
        total,
        fallback,
      )
    );

    const renderSidebarLcAttrs = (sourceNodes, index, total) => {
      const attrs = ['data-lc-anim', 'data-lc-duration', 'data-lc-ease', 'data-lc-delay'];
      return attrs.map((attrName) => {
        const value = mappedSidebarNodeValue(sourceNodes, index, total, attrName, '');
        return value ? ' ' + attrName + '="' + escapeHtml(value) + '"' : '';
      }).join('');
    };

    const resolveSidebarTargetImpIndex = (sourceImpIndex, sourceCount, targetCount, requestedIndex) => {
      const requested = Number(requestedIndex);
      if (Number.isFinite(requested) && requested >= 0 && requested < targetCount) {
        return requested;
      }
      if (sourceImpIndex < 0 || sourceCount <= 0 || targetCount <= 0) return -1;
      if (sourceCount === 1 || targetCount === 1) return 0;
      return Math.max(
        0,
        Math.min(
          targetCount - 1,
          Math.round((sourceImpIndex * (targetCount - 1)) / Math.max(1, sourceCount - 1)),
        ),
      );
    };

    const splitSidebarWordsForSlots = (words, slotCount) => {
      if (!words.length || !slotCount) return [];
      const slots = Array.from({ length: slotCount }, () => []);
      words.forEach((word, index) => {
        slots[Math.min(slotCount - 1, Math.floor((index * slotCount) / words.length))].push(word);
      });
      return slots.map((slot) => slot.join(' '));
    };

    const replaceSidebarWordByWord = (container, words, impWordIndex, impWordIndices = []) => {
      if (!container || !words.length) return false;
      const isNewWbw = container.classList.contains('wbw-line');
      const selector = isNewWbw ? '.wbw-word' : '.w';
      const fallback = isNewWbw ? 'wbw-word normal' : 'w';
      const sourceNodes = Array.from(container.querySelectorAll(selector));
      const sourceClasses = sourceNodes
        .map((word) => cleanSidebarClassName(word.className, fallback));
      const impPattern = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/;
      const sourceImpIndex = sourceClasses.findIndex((className) => impPattern.test(className));
      const impClass = sourceImpIndex >= 0 ? sourceClasses[sourceImpIndex].match(impPattern)?.[0] || '' : '';
      const fallbackImpIndex = resolveSidebarTargetImpIndex(sourceImpIndex, sourceClasses.length, words.length, impWordIndex);
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
      container.innerHTML = words.map((word, index) => {
        const mapped = mappedSidebarClassName(sourceClasses, index, words.length, fallback)
          .replace(/\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/g, '')
          .replace(/\\s+/g, ' ')
          .trim();
        const isEmphasis = targetImpIndices.has(index);
        const emphasis = isEmphasis && impClass ? ' ' + impClass : '';
        return '<span data-export-caption-text="true" data-w="' + index + '" class="' + (mapped || fallback) + emphasis + (isEmphasis ? ' is-emphasis' : '') + '"' + renderSidebarLcAttrs(sourceNodes, index, words.length) + '>' + escapeHtml(word) + '</span>';
      }).join(' ');
      return true;
    };

    const replaceSidebarSticky = (container, words, impWordIndex, impWordIndices = []) => {
      const stickyWords = Array.from(container.querySelectorAll('.sw-w'));
      if (!stickyWords.length || !words.length) return false;
      const sourceClasses = stickyWords.map((word) => cleanSidebarClassName(word.className, 'sw-w'));
      const impPattern = /\\b(?:imp-[\\w-]+|ns[23]-[\\w-]+)\\b/;
      const sourceImpIndex = sourceClasses.findIndex((className) => impPattern.test(className));
      const fallbackImpIndex = resolveSidebarTargetImpIndex(sourceImpIndex, sourceClasses.length, words.length, impWordIndex);
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, fallbackImpIndex, impWordIndices));
      container.innerHTML = words.map((word, index) => (
        '<span data-export-caption-text="true" data-w="' + index + '" class="' + mappedSidebarClassName(sourceClasses, index, words.length, 'sw-w') + (targetImpIndices.has(index) ? ' is-emphasis' : '') + '"' + renderSidebarLcAttrs(stickyWords, index, words.length) + '>' + escapeHtml(word) + '</span>'
      )).join(' ');
      return true;
    };

    const replaceSidebarLcCaptionText = (container, words, impWordIndex, impWordIndices = []) => {
      const sourceSpans = Array.from(container.querySelectorAll('.w'));
      if (!sourceSpans.length || !words.length) return false;
      const rows = Array.from(new Set(sourceSpans.map((span) => span.parentElement).filter(Boolean)));
      const sourceByRow = rows.map((row) => Array.from(row.querySelectorAll(':scope > .w')));
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      const totalSlots = sourceByRow.reduce((sum, rowSpans) => sum + rowSpans.length, 0);
      let wordCursor = 0;

      sourceByRow.forEach((rowSpans, rowIndex) => {
        const row = rows[rowIndex];
        const remainingRows = sourceByRow.length - rowIndex - 1;
        const remainingWords = words.length - wordCursor;
        const proportional = Math.round((rowSpans.length / Math.max(1, totalSlots)) * words.length);
        const rowWordCount = rowIndex === sourceByRow.length - 1
          ? remainingWords
          : Math.max(0, Math.min(remainingWords, Math.max(1, Math.min(remainingWords - remainingRows, proportional))));
        const rowWords = words.slice(wordCursor, wordCursor + rowWordCount);
        const sourceClasses = rowSpans.map((span) => cleanSidebarClassName(span.className, 'w'));
        const sourceVisible = rowSpans.map((span) => span.classList.contains('on') && !span.getAttribute('data-lc-anim'));
        const sourceStyles = rowSpans.map((span) => String(span.getAttribute('style') || '').replace(/\\banimation\\s*:[^;]+;?/gi, '').trim());
        const sourceRowHasUnderline = rowSpans.some((span) => (
          span.matches('.ul, .ns3hero, .imp-underline')
        ));
        const createdRowSpans = [];
        row.textContent = '';
        rowWords.forEach((word, localIndex) => {
          if (localIndex > 0) row.appendChild(document.createTextNode(' '));
          const wordIndex = wordCursor + localIndex;
          const span = document.createElement('span');
          const className = mappedSidebarClassName(sourceClasses, localIndex, rowWords.length, 'w')
            .replace(/\\bis-emphasis\\b/g, '')
            .replace(/\\s+/g, ' ')
            .trim();
          span.dataset.exportCaptionText = 'true';
          span.dataset.w = String(wordIndex);
          span.className = (className || 'w')
            + (targetImpIndices.has(wordIndex) ? ' is-emphasis' : '')
            + (mappedSidebarClassName(sourceVisible, localIndex, rowWords.length, false) ? ' on' : '');
          for (const attrName of ['data-lc-anim', 'data-lc-duration', 'data-lc-ease', 'data-lc-delay']) {
            const value = mappedSidebarNodeValue(rowSpans, localIndex, rowWords.length, attrName, '');
            if (value) span.setAttribute(attrName, value);
          }
          const sourceStyle = mappedSidebarClassName(sourceStyles, localIndex, rowWords.length, '');
          if (sourceStyle) span.setAttribute('style', sourceStyle);
          span.textContent = word;
          row.appendChild(span);
          createdRowSpans.push(span);
        });
        const emphasizedRowSpans = createdRowSpans.filter((span) => span.classList.contains('is-emphasis'));
        if (sourceRowHasUnderline && emphasizedRowSpans.length >= 2) {
          emphasizedRowSpans.forEach((span) => {
            span.dataset.pairedEmphasisUnderline = 'true';
          });
        }
        wordCursor += rowWordCount;
      });
      return true;
    };

    const replaceSidebarPositioned = (block, words, impWordIndex, impWordIndices = [], forceContiguous = false) => {
      const spans = Array.from(block.querySelectorAll('.sw'));
      if (!spans.length || !words.length) return false;
      const rows = Array.from(new Set(spans.map((span) => span.parentElement).filter(Boolean)));
      const sourceByRow = rows.map((row) => Array.from(row.querySelectorAll(':scope > .sw')));
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      if (forceContiguous && sourceByRow.length > 1) {
        const sourceClasses = spans.map((span) => cleanSidebarClassName(span.className, 'sw'));
        const sourceAnims = spans.map((span) => span.getAttribute('data-anim') || 'rise');
        const heroRowIndex = rows.findIndex((row) => /\\b(hero|l3|bold|impact)\\b/.test(row.className || ''));
        const targetRow = rows[heroRowIndex >= 0 ? heroRowIndex : rows.length - 1];
        rows.forEach((row) => { row.textContent = ''; });
        targetRow.style.paddingLeft = '0';
        targetRow.style.textAlign = 'center';
        words.forEach((word, wordIndex) => {
          if (wordIndex > 0) targetRow.appendChild(document.createTextNode(' '));
          const span = document.createElement('span');
          span.dataset.exportCaptionText = 'true';
          span.dataset.w = String(wordIndex);
          span.className = mappedSidebarClassName(sourceClasses, wordIndex, words.length, 'sw')
            + (targetImpIndices.has(wordIndex) ? ' is-emphasis' : '');
          span.dataset.anim = mappedSidebarClassName(sourceAnims, wordIndex, words.length, 'rise');
          span.textContent = word;
          targetRow.appendChild(span);
        });
        return true;
      }
      const totalSlots = sourceByRow.reduce((sum, rowSpans) => sum + rowSpans.length, 0);
      let wordCursor = 0;
      sourceByRow.forEach((rowSpans, rowIndex) => {
        const row = rows[rowIndex];
        const remainingRows = sourceByRow.length - rowIndex - 1;
        const proportional = Math.round((rowSpans.length / Math.max(1, totalSlots)) * words.length);
        const rowWordCount = rowIndex === sourceByRow.length - 1
          ? words.length - wordCursor
          : Math.max(1, Math.min(words.length - wordCursor - remainingRows, proportional));
        const rowWords = words.slice(wordCursor, wordCursor + rowWordCount);
        const sourceClasses = rowSpans.map((span) => cleanSidebarClassName(span.className, 'sw'));
        const sourceAnims = rowSpans.map((span) => span.getAttribute('data-anim') || 'rise');
        row.textContent = '';
        rowWords.forEach((word, localIndex) => {
          if (localIndex > 0) row.appendChild(document.createTextNode(' '));
          const span = document.createElement('span');
          span.dataset.exportCaptionText = 'true';
          const globalWordIndex = wordCursor + localIndex;
          span.dataset.w = String(globalWordIndex);
          span.className = mappedSidebarClassName(sourceClasses, localIndex, rowWords.length, 'sw')
            + (targetImpIndices.has(globalWordIndex) ? ' is-emphasis' : '');
          span.dataset.anim = mappedSidebarClassName(sourceAnims, localIndex, rowWords.length, 'rise');
          for (const attrName of ['data-lc-anim', 'data-lc-duration', 'data-lc-ease', 'data-lc-delay']) {
            const value = mappedSidebarNodeValue(rowSpans, localIndex, rowWords.length, attrName, '');
            if (value) span.setAttribute(attrName, value);
          }
          span.textContent = word;
          row.appendChild(span);
        });
        wordCursor += rowWordCount;
      });
      return true;
    };

    const replaceSidebarPlain = (block, words, impWordIndex, impWordIndices = []) => {
      const plain = Array.from(block.querySelectorAll('.plain-s'))
        .find((element) => !element.classList.contains('wbw') && !element.classList.contains('wbw-line'));
      if (!plain || !words.length) return false;
      plain.dataset.exportCaptionText = 'true';
      plain.textContent = '';
      const targetImpIndices = new Set(resolveImpWordIndicesForWords(words, impWordIndex, impWordIndices));
      words.forEach((word, index) => {
        if (index > 0) plain.appendChild(document.createTextNode(' '));
        const span = document.createElement('span');
        span.className = targetImpIndices.has(index) ? 'is-emphasis' : 'plain-word';
        span.dataset.exportCaptionText = 'true';
        span.dataset.w = String(index);
        span.textContent = word;
        plain.appendChild(span);
      });
      return true;
    };

    const replaceSidebarTemplateText = (block, captionText, impWordIndex, impWordIndices = [], forceContiguousPositioned = false, templateSource = '') => {
      const words = String(captionText || '').trim().split(/\\s+/).filter(Boolean);
      block.querySelectorAll('.wbw, .wbw-line').forEach((container) => replaceSidebarWordByWord(container, words, impWordIndex, impWordIndices));
      block.querySelectorAll('.sw-line').forEach((container) => replaceSidebarSticky(container, words, impWordIndex, impWordIndices));
      if (templateSource === 'lekha-lc') {
        block.querySelectorAll('.cpt, .nline').forEach((container) => replaceSidebarLcCaptionText(container, words, impWordIndex, impWordIndices));
      }
      replaceSidebarPositioned(block, words, impWordIndex, impWordIndices, forceContiguousPositioned);
      replaceSidebarPlain(block, words, impWordIndex, impWordIndices);
    };

    const getSidebarWordMotion = (word) => {
      const wordClasses = word?.classList || { contains: () => false };
      if (wordClasses.contains('imp-gold')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 100% 0 0)' };
      if (wordClasses.contains('imp-underline')) return { transform: 'none', opacity: '1', clipPath: 'inset(100% 0 0 0)' };
      if (wordClasses.contains('imp-rose')) return {
        transform: 'none',
        opacity: '1',
        clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)',
        finalClipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
      };
      if (wordClasses.contains('imp-space')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 50% 0 50%)' };
      if (wordClasses.contains('imp-cyan')) return { transform: 'skewX(-18deg) translateX(-12px)', opacity: '0' };
      if (wordClasses.contains('imp-purple')) return { transform: 'rotateX(-90deg)', opacity: '0', origin: 'center bottom' };
      if (wordClasses.contains('imp-bold')) return { transform: 'translateY(-30px)', opacity: '0' };
      if (wordClasses.contains('imp-green')) return { transform: 'scale(0.82)', opacity: '0' };
      if (wordClasses.contains('imp-italic')) return { transform: 'translateY(-20px)', opacity: '0' };
      if (wordClasses.contains('imp-box')) return { transform: 'translate(-12px, 8px)', opacity: '0' };
      if (wordClasses.contains('imp-weight') || wordClasses.contains('imp-stamp')) return { transform: 'scale(1.3)', opacity: '0' };
      if (wordClasses.contains('imp-typewrite') || wordClasses.contains('imp-flicker')) return { transform: 'none', opacity: '0' };
      const parent = word?.parentElement;
      const classes = parent ? parent.classList : { contains: () => false };
      if (classes.contains('wrise')) return { transform: 'translateY(22px)', opacity: '0' };
      if (classes.contains('wslide') || classes.contains('wbw-slide')) return { transform: 'translateX(-26px)', opacity: '0' };
      if (classes.contains('wslider')) return { transform: 'translateX(26px)', opacity: '0' };
      if (classes.contains('wroll')) return { transform: 'translateY(14px) rotate(-6deg)', opacity: '0', origin: 'left bottom' };
      if (classes.contains('wwipe')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 100% 0 0)' };
      if (classes.contains('wwipeup')) return { transform: 'none', opacity: '1', clipPath: 'inset(100% 0 0 0)' };
      if (classes.contains('wfade')) return { transform: 'none', opacity: '0' };
      if (classes.contains('wscale')) return { transform: 'scale(0.5)', opacity: '0' };
      if (classes.contains('wflip')) return { transform: 'rotateX(-80deg)', opacity: '0', origin: 'center bottom' };
      if (classes.contains('wbounce')) return { transform: 'translateY(-22px)', opacity: '0' };
      if (classes.contains('wdiag')) return { transform: 'translate(-16px, 16px)', opacity: '0' };
      if (classes.contains('wexpand')) return { transform: 'scaleX(0.15)', opacity: '0', origin: 'center' };
      if (classes.contains('wskew')) return { transform: 'skewX(-18deg) translateX(-12px)', opacity: '0' };
      if (classes.contains('wstencil')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 50% 0 50%)' };
      if (classes.contains('wlift')) return { transform: 'translateY(-22px)', opacity: '0' };
      return { transform: 'translateY(22px)', opacity: '0' };
    };

    const getSidebarSwMotion = (element) => {
      const key = element.dataset.anim || Array.from(element.classList).find((className) => (
        /^(rise|slide-l|slide-r|slide-slow|fade|wipe|reveal-up|diagonal-wipe|pop|zoom-out|rotate-in|roll|forge|unfold)$/.test(className)
      )) || 'fade';
      if (/slide-l|slide-slow/.test(key)) return { transform: 'translateX(-28px)', opacity: '0' };
      if (/slide-r/.test(key)) return { transform: 'translateX(28px)', opacity: '0' };
      if (/rise/.test(key)) return { transform: 'translateY(20px)', opacity: '0' };
      if (/pop|zoom-out/.test(key)) return { transform: 'scale(0.82)', opacity: '0' };
      if (/rotate|roll/.test(key)) return { transform: 'rotateX(-80deg)', opacity: '0', origin: 'center bottom' };
      if (/wipe|reveal|forge|unfold|diagonal/.test(key)) return { transform: 'none', opacity: '1', clipPath: /diagonal/.test(key) ? 'polygon(0 0, 0 0, 0 100%, 0 100%)' : 'inset(0 100% 0 0)' };
      return { transform: 'none', opacity: '0' };
    };

    const fitSidebarStagger = (base, count) => {
      if (count <= 1) return 0;
      return base;
    };

    // Shared LC source schedule — serialized verbatim from
    // src/components/dashboard/templateMotionConfig.js so the exported video
    // uses the exact word delays/durations the canvas preview renders. The
    // caption-fit pass is the SAME helper the canvas runs: without it, short
    // speech captions end before the authored reveal finishes in the export.
    const getLcMotionSchedule = ${getLcMotionSchedule.toString()};
    const fitLcMotionScheduleToCaption = ${fitLcMotionScheduleToCaption.toString()};

    const chooseSidebarPhase = (blocks, elapsedMs, fallbackDuration, phaseIndex) => {
      if (!blocks.length) return { block: null, index: 0, phaseStartMs: 0 };
      const normalizedIndex = ((Number(phaseIndex || 0) % blocks.length) + blocks.length) % blocks.length;
      return {
        block: blocks[normalizedIndex],
        index: normalizedIndex,
        phaseStartMs: 0,
        duration: fallbackDuration || 3000,
      };
    };

    const parseSidebarAnimationDelayMs = (value = '') => {
      const match = String(value || '').trim().match(/^(-?\\d*\\.?\\d+)(ms|s)$/i);
      if (!match) return 0;
      const amount = Number(match[1]);
      if (!Number.isFinite(amount)) return 0;
      return match[2].toLowerCase() === 's' ? amount * 1000 : amount;
    };

    const activateSidebarTemplateShells = (root, time) => {
      root.querySelectorAll('.lekha-sidebar-export-template-shell').forEach((shell) => {
        // A caption remains active across many sampled frames. Its source
        // markup and animation schedule are immutable, so initialize them once
        // and let the explicit animation seek below advance the existing DOM.
        if (shell.dataset.exportInitialized === 'true') return;
        const captionText = shell.dataset.captionText || '';
        const captionStart = Number(shell.dataset.captionStart || 0);
        const captionEnd = Number(shell.dataset.captionEnd || captionStart);
        const captionDurationMs = Math.max(0, (captionEnd - captionStart) * 1000);
        const phaseIndex = Number(shell.dataset.templatePhaseIndex || shell.dataset.captionIndex || 0);
        const impWordIndex = Number(shell.dataset.impWordIndex || -1);
        let impWordIndices = [];
        try {
          const parsed = JSON.parse(shell.dataset.impWordIndices || '[]');
          impWordIndices = Array.isArray(parsed) ? parsed : [];
        } catch {
          impWordIndices = [];
        }
        const templateSource = shell.dataset.templateSource || '';
        const isLcTemplateSet = templateSource === 'lekha-lc';
        const elapsedMs = Math.max(0, (time - captionStart) * 1000);
        const fallbackDuration = 3000;
        // Parity with the live preview's per-source timing. LC nodes retain the
        // authored delay/duration/easing from the original template markup.
        const wordStagger = ${SIDEBAR_TEMPLATE_WORD_STAGGER_SECONDS * 1000};
        const blocks = Array.from(shell.querySelectorAll('.sb, .sblock'));
        const dots = Array.from(shell.querySelectorAll('.dots i, .lk-dots i'));

        blocks.forEach((block) => {
          replaceSidebarTemplateText(block, captionText, impWordIndex, impWordIndices, false, templateSource);
          block.classList.remove('active');
          block.style.opacity = '0';
          block.style.visibility = 'hidden';
          block.style.zIndex = '0';
          block.querySelectorAll('.w, .wbw-word').forEach((word) => {
            const motion = getSidebarWordMotion(word);
            word.classList.remove('visible', 'anim', 'in');
            word.classList.remove('sidebar-export-word-anim', 'sidebar-export-lc-anim');
            word.style.removeProperty('animation');
            word.style.setProperty('--sidebar-export-initial-transform', motion.transform || 'none');
            word.style.setProperty('--sidebar-export-initial-opacity', motion.opacity || '0');
            word.style.setProperty('--sidebar-export-initial-clip', motion.clipPath || 'inset(0 0 0 0)');
            word.style.setProperty('--sidebar-export-final-clip', motion.finalClipPath || 'inset(0 0 0 0)');
            word.style.transformOrigin = motion.origin || '';
          });
          block.querySelectorAll('.sw').forEach((element) => {
            element.classList.remove('in', 'sidebar-export-sw-anim', 'sidebar-export-lc-anim');
            element.style.removeProperty('animation');
            const motion = getSidebarSwMotion(element);
            element.style.setProperty('--sidebar-export-initial-transform', motion.transform || 'none');
            element.style.setProperty('--sidebar-export-initial-opacity', motion.opacity || '0');
            element.style.setProperty('--sidebar-export-initial-clip', motion.clipPath || 'inset(0 0 0 0)');
            element.style.transformOrigin = motion.origin || '';
          });
          block.querySelectorAll('.sw-w').forEach((word) => {
            word.classList.remove('sidebar-export-lc-anim');
            // The 0.14 dimmed-context look belongs to the lekha-20/49 sticky
            // design. LC supporting words are fully visible on the canvas.
            word.style.opacity = isLcTemplateSet ? '' : '0.14';
          });
          block.querySelectorAll('.plainwrap, [data-lc-block-anim]').forEach((wrap) => {
            wrap.classList.remove('sidebar-export-lc-anim');
            wrap.style.removeProperty('animation');
          });
        });

        const phase = chooseSidebarPhase(blocks, elapsedMs, fallbackDuration, phaseIndex);
        if (!phase.block) return;
        phase.block.style.visibility = 'visible';
        phase.block.style.zIndex = '2';
        phase.block.style.opacity = '1';
        phase.block.classList.add('active');
        // Parity with the live preview: word colour/weight come from inheritance
        // (the shell's inline style mirrors the preview host) plus the template's
        // own class CSS. Never force them per word — that flattens the dimmed
        // context alphas (rgba support rows) and the bold hero tiers that give
        // each template its identity, and it breaks the weight-based hero
        // detection below.
        const shellStyles = getComputedStyle(shell);
        const emphasisAccent = shellStyles.getPropertyValue('--template-highlight').trim()
          || shellStyles.getPropertyValue('--sidebar-emphasis-accent').trim()
          || '#DDAA03';
        const getLcEmphasisColor = (word) => (
          isLcTemplateSet && word.closest('.ln.box')
            ? '#101114'
            : emphasisAccent
        );
        phase.block.querySelectorAll('.is-emphasis').forEach((word) => {
          const emphasisColor = getLcEmphasisColor(word);
          word.style.setProperty('font-size', 'inherit', 'important');
          word.style.setProperty('line-height', 'inherit', 'important');
          word.style.setProperty('vertical-align', 'baseline', 'important');
          word.style.setProperty('color', emphasisColor, 'important');
          word.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
        });
        const emphasisByLine = new Map();
        phase.block.querySelectorAll('.is-emphasis').forEach((word) => {
          const line = word.parentElement || phase.block;
          const lineWords = emphasisByLine.get(line) || [];
          lineWords.push(word);
          emphasisByLine.set(line, lineWords);
        });
        let hasPairedEmphasis = false;
        emphasisByLine.forEach((lineWords) => {
          if (lineWords.length < 2) return;
          hasPairedEmphasis = true;
          const hasUnderline = lineWords.some((word) => {
            const styles = getComputedStyle(word);
            return word.matches('.ul, .ns3hero, .imp-underline')
              || styles.textDecorationLine.includes('underline')
              || (styles.borderBottomStyle !== 'none' && parseFloat(styles.borderBottomWidth) > 0);
          });
          if (hasUnderline) {
            lineWords.forEach((word) => {
              word.dataset.pairedEmphasisUnderline = 'true';
            });
          }
        });
        // Parity with the live preview (recolorEmphasisToHero in VideoPlayer.jsx):
        // the accent colour belongs on the BOLD / hero word(s) — the largest size,
        // or the heaviest weight when sizes are uniform — not the semantic
        // is-emphasis word. Detect the bold tier and move the colour there.
        (function () {
          if (hasPairedEmphasis) return;
          const heroAtoms = Array.from(phase.block.querySelectorAll('.w, .wbw-word, .sw, .sw-w'));
          if (heroAtoms.length < 2) return;
          const heroMeasure = heroAtoms.map((el) => {
            const cs = getComputedStyle(el);
            return { el: el, fs: parseFloat(cs.fontSize) || 0, fw: parseInt(cs.fontWeight, 10) || 400 };
          });
          const heroSizes = heroMeasure.map((m) => m.fs).filter((v) => v > 0);
          if (heroSizes.length < 2) return;
          const heroMaxFs = Math.max.apply(null, heroSizes);
          const heroMinFs = Math.min.apply(null, heroSizes);
          let heroPick = [];
          if (heroMaxFs >= heroMinFs * 1.18) {
            heroPick = heroMeasure.filter((m) => m.fs >= heroMaxFs - 0.5).map((m) => m.el);
          } else {
            const heroWeights = heroMeasure.map((m) => m.fw);
            const heroMaxFw = Math.max.apply(null, heroWeights);
            const heroMinFw = Math.min.apply(null, heroWeights);
            if (heroMaxFw >= 700 && heroMaxFw - heroMinFw >= 200) {
              heroPick = heroMeasure.filter((m) => m.fw >= heroMaxFw - 50).map((m) => m.el);
            }
          }
          if (!heroPick.length || heroPick.length === heroAtoms.length) return;
          // Demote exactly like the preview: drop the is-emphasis class (and the
          // inline accent set above) so the word falls back to its source-CSS
          // class colour — do NOT force the caption text colour onto it.
          heroAtoms.forEach((el) => {
            if (!el.classList.contains('is-emphasis')) return;
            el.classList.remove('is-emphasis');
            el.style.removeProperty('color');
            el.style.removeProperty('-webkit-text-fill-color');
            el.style.removeProperty('font-size');
            el.style.removeProperty('line-height');
            el.style.removeProperty('vertical-align');
          });
          heroPick.forEach((el) => {
            const emphasisColor = getLcEmphasisColor(el);
            el.style.setProperty('color', emphasisColor, 'important');
            el.style.setProperty('-webkit-text-fill-color', emphasisColor, 'important');
          });
        })();
        dots.forEach((dot, dotIndex) => {
          dot.className = dotIndex === phase.index ? 'on' : '';
        });

        // LC motion nodes use the same authored source schedule as the canvas,
        // fitted to the caption duration with the SAME shared helper the canvas
        // runs (fitLcMotionScheduleToCaption) so every word reaches its final
        // keyframe before the caption ends in the exported video too.
        if (isLcTemplateSet) {
          const lcMotionWords = Array.from(phase.block.querySelectorAll('[data-lc-anim]'));
          const lcSchedule = fitLcMotionScheduleToCaption(getLcMotionSchedule(lcMotionWords.map((word) => ({
            animation: word.dataset.lcAnim,
            duration: word.dataset.lcDuration,
            delay: word.dataset.lcDelay,
            ease: word.dataset.lcEase,
          }))), captionDurationMs);
          lcMotionWords.forEach((word, index) => {
            const entry = lcSchedule.entries[index];
            if (!entry?.animation) return;
            // Mirror the canvas: motion words carry no stale inline state — the
            // authored keyframes own opacity/transform/clip for the whole ride.
            word.style.opacity = '';
            word.style.transform = '';
            word.style.clipPath = '';
            word.style.setProperty('--sidebar-export-lc-animation', entry.animation);
            word.style.setProperty('--sidebar-export-word-duration', entry.durationMs + 'ms');
            word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + entry.delayMs) + 'ms');
            word.style.setProperty('--sidebar-export-lc-ease', entry.ease);
            word.classList.add('sidebar-export-lc-anim');
          });
          // Plain scenes: the wrap fades in as one unit while its words stay
          // statically visible. Mirrors the canvas stamp in initializeLcTimeline.
          phase.block.querySelectorAll('.plainwrap').forEach((wrap) => {
            const plainEntry = fitLcMotionScheduleToCaption(getLcMotionSchedule([{
              animation: 'fade',
              duration: ${LC_TEMPLATE_TIMING.plainFadeDurationMs},
              delay: 0,
              ease: 'ease',
            }]), captionDurationMs).entries[0];
            wrap.style.setProperty('--sidebar-export-lc-animation', 'fade');
            wrap.style.setProperty('--sidebar-export-word-duration', (plainEntry?.durationMs || ${LC_TEMPLATE_TIMING.plainFadeDurationMs}) + 'ms');
            wrap.style.setProperty('--sidebar-export-word-delay', phase.phaseStartMs + 'ms');
            wrap.style.setProperty('--sidebar-export-lc-ease', 'ease');
            wrap.classList.add('sidebar-export-lc-anim');
          });
          // Whole-line 'block' scenes (LC4/LC5): the wrap carries one authored
          // animation while its words stay statically visible. Mirrors the
          // canvas stamp in VideoPlayer.jsx initializeLcTimeline.
          phase.block.querySelectorAll('[data-lc-block-anim]').forEach((wrap) => {
            const wrapSchedule = fitLcMotionScheduleToCaption(getLcMotionSchedule([{
              animation: wrap.dataset.lcBlockAnim,
              duration: wrap.dataset.lcBlockDuration,
              delay: wrap.dataset.lcBlockDelay,
              ease: wrap.dataset.lcBlockEase,
            }]), captionDurationMs);
            const wrapEntry = wrapSchedule.entries[0];
            if (!wrapEntry?.animation) return;
            wrap.style.setProperty('--sidebar-export-lc-animation', wrapEntry.animation);
            wrap.style.setProperty('--sidebar-export-word-duration', (wrapEntry.durationMs || 560) + 'ms');
            wrap.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + wrapEntry.delayMs) + 'ms');
            wrap.style.setProperty('--sidebar-export-lc-ease', wrapEntry.ease);
            wrap.classList.add('sidebar-export-lc-anim');
          });
        }

        phase.block.querySelectorAll('.w, .wbw-word').forEach((word, index) => {
          const lcAnim = isLcTemplateSet ? String(word.dataset.lcAnim || '').trim() : '';
          const phaseWordStagger = fitSidebarStagger(wordStagger, phase.block.querySelectorAll('.w, .wbw-word').length);
          if (lcAnim) return; // already timed by the LC motion pass above
          if (isLcTemplateSet) {
            // Parity with the canvas: every LC word without authored motion is
            // a static supporting word — visible for the whole caption, never
            // run through the legacy stagger reveal.
            word.style.animation = 'none';
            word.style.opacity = '1';
            word.style.transform = 'none';
            word.style.clipPath = 'inset(0 0 0 0)';
            word.classList.add('in', 'visible');
            return;
          }
          if (word.classList.contains('imp-flicker') || word.classList.contains('imp-typewrite')) {
            word.style.setProperty('--sidebar-export-initial-transform', 'none');
            word.style.setProperty('transform', 'none');
          }
          const duration = /\\b(imp-|ns[23]-)/.test(word.className)
            ? ${LEGACY_TEMPLATE_TIMING.wordDurationMs + 160}
            : ${LEGACY_TEMPLATE_TIMING.wordDurationMs};
          word.style.setProperty('--sidebar-export-word-duration', duration + 'ms');
          word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * phaseWordStagger) + 'ms');
          word.classList.add('sidebar-export-word-anim');
        });
        phase.block.querySelectorAll('.sw').forEach((element, index) => {
          const lcAnim = isLcTemplateSet ? String(element.dataset.lcAnim || '').trim() : '';
          if (lcAnim) return; // already timed by the LC motion pass above
          if (isLcTemplateSet) {
            element.style.animation = 'none';
            element.style.opacity = '1';
            element.style.transform = 'none';
            element.style.clipPath = 'inset(0 0 0 0)';
            element.classList.add('in');
            return;
          }
          const phaseSwStagger = fitSidebarStagger(${SIDEBAR_TEMPLATE_POSITION_STAGGER_SECONDS * 1000}, phase.block.querySelectorAll('.sw').length);
          element.style.setProperty('--sidebar-export-word-duration', '300ms');
          element.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * phaseSwStagger) + 'ms');
          element.classList.add('sidebar-export-sw-anim');
        });
        phase.block.querySelectorAll('.sw-w').forEach((word, index) => {
          const lcAnim = isLcTemplateSet ? String(word.dataset.lcAnim || '').trim() : '';
          if (lcAnim) return; // already timed by the LC motion pass above
          if (isLcTemplateSet) {
            word.style.animation = 'none';
            word.style.opacity = '1';
            word.style.transform = 'none';
            word.style.clipPath = 'inset(0 0 0 0)';
            word.classList.add('in');
            return;
          }
          const phaseStickyStagger = fitSidebarStagger(
            ${SIDEBAR_TEMPLATE_POSITION_STAGGER_SECONDS * 1000},
            phase.block.querySelectorAll('.sw-w').length,
          );
          word.style.setProperty('--sidebar-export-word-delay', (phase.phaseStartMs + index * phaseStickyStagger) + 'ms');
          word.classList.add('sidebar-export-sticky-anim');
        });
        shell.dataset.exportInitialized = 'true';
      });
    };

    const buildSidebarTemplateMarkup = (caption, globalStyle) => {
      const appliedStyle = caption.applied_template_style || {};
      const templateSource = caption.template_source || appliedStyle.template_source || globalStyle?.template_source || '';
      const templateMarkup = sanitizeSidebarTemplateMarkup(
        caption.template_markup || appliedStyle.template_markup || globalStyle?.template_markup || '',
        templateSource === 'lekha-lc',
      );
      if (!templateMarkup) return '';
      const colorCustomizedClass = globalStyle?.template_color_customized || appliedStyle.template_color_customized
        ? ' is-color-customized'
        : '';
      return '<div class="lekha-sidebar-export-template-shell' + colorCustomizedClass + '"'
        + ' data-caption-id="' + escapeHtml(caption.id || '') + '"'
        + ' data-caption-text="' + escapeHtml(transformText(caption.text || '', globalStyle)) + '"'
        + ' data-caption-start="' + Number(caption.start_time || 0) + '"'
        + ' data-caption-end="' + Number(caption.end_time || caption.start_time || 0) + '"'
        + ' data-caption-index="' + Number(caption.__templateIndex || 0) + '"'
        + ' data-template-phase-index="' + Number(caption.__templateIndex ?? caption.template_phase_index ?? 0) + '"'
        + ' data-imp-word-index="' + Number(caption.imp_word_index ?? -1) + '"'
        + ' data-imp-word-indices="' + escapeHtml(JSON.stringify(normalizeImpWordIndices(caption.imp_word_index, caption.imp_word_indices || []))) + '"'
        + ' data-emphasis-color="' + escapeHtml(caption.emphasis_color || '') + '"'
        + ' data-caption-font-weight="' + escapeHtml(globalStyle?.font_weight || appliedStyle.font_weight || '400') + '"'
        + ' data-caption-text-color="' + escapeHtml(globalStyle?.text_color || appliedStyle.text_color || '#FFFFFF') + '"'
        + ' data-template-source="' + escapeHtml(templateSource) + '"'
        + ' data-template-complex-script="' + (usesComplexTemplateScript(caption.text || '') ? 'true' : 'false') + '"'
        + ' style="--sidebar-source-font:\\'' + escapeHtml(globalStyle?.font_family || appliedStyle.font_family || 'Inter') + '\\';'
        + '--sidebar-emphasis-accent:' + escapeHtml((() => {
          const configured = String(caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '').trim();
          const textColor = String(globalStyle?.text_color || appliedStyle.text_color || '#FFFFFF').trim();
          return configured && configured.toLowerCase() !== textColor.toLowerCase() ? configured : '#DDAA03';
        })()) + ';'
        + '--sidebar-template-highlight:' + escapeHtml(caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-primary:' + escapeHtml(globalStyle?.text_color || appliedStyle.text_color || '#FFFFFF') + ';'
        + '--template-secondary:' + escapeHtml(globalStyle?.secondary_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-highlight:' + escapeHtml(caption.emphasis_color || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-text-gradient:' + escapeHtml(globalStyle?.text_gradient || appliedStyle.text_gradient || 'none') + ';'
        + '--template-highlight-gradient:' + escapeHtml(globalStyle?.highlight_gradient || appliedStyle.highlight_gradient || 'none') + ';'
        + '--template-karaoke-1:' + escapeHtml(globalStyle?.karaoke_color_1 || globalStyle?.highlight_color || globalStyle?.emphasis_color || globalStyle?.secondary_color || appliedStyle.karaoke_color_1 || appliedStyle.highlight_color || appliedStyle.emphasis_color || appliedStyle.secondary_color || '#DDAA03') + ';'
        + '--template-karaoke-2:' + escapeHtml(globalStyle?.karaoke_color_2 || appliedStyle.karaoke_color_2 || '#22D3EE') + ';'
        + '--template-karaoke-3:' + escapeHtml(globalStyle?.karaoke_color_3 || appliedStyle.karaoke_color_3 || '#FB923C') + ';'
        + 'font-family:\\'' + escapeHtml(globalStyle?.font_family || appliedStyle.font_family || 'Inter') + '\\';'
        + 'font-size:' + scaleExportPx(globalStyle?.font_size || appliedStyle.font_size || 22) + 'px;'
        + 'font-weight:' + escapeHtml(globalStyle?.font_weight || appliedStyle.font_weight || '300') + ';'
        // Mirror the preview host's inline style so inherited text properties
        // resolve identically in both renderers.
        + 'color:' + escapeHtml(appliedStyle.text_color ? (globalStyle?.text_color || appliedStyle.text_color) : (globalStyle?.text_color || '#FFFFFF')) + ';'
        + 'font-style:' + escapeHtml(globalStyle?.font_style || appliedStyle.font_style || 'normal') + ';'
        + 'line-height:' + escapeHtml(String(appliedStyle.line_spacing ? (globalStyle?.line_spacing || appliedStyle.line_spacing) : (globalStyle?.line_spacing || 1.25))) + ';'
        + 'opacity:' + escapeHtml(String(templateSource === 'lekha-lc' ? 1 : (globalStyle?.text_opacity ?? appliedStyle.text_opacity ?? 1))) + ';"'
        + '>' + templateMarkup + '</div>';
    };

    const buildAbsoluteCptMarkup = (caption, globalStyle, time) => {
      const words = buildWordMeta(caption);
      const currentIndex = getCurrentWordIndex(caption, time);
      const emphasisIndices = new Set(normalizeImpWordIndices(
        caption.imp_word_index,
        caption.imp_word_indices || [],
      ));
      return '<div class="absolute-cpt-layer" data-absolute-cpt-layer="true">'
        + words.map((word, index) => {
          const wordStyle = word.style || {};
          if (!hasAbsoluteWordPosition(wordStyle)) return '';
          const isEmphasis = Boolean(wordStyle.isEmphasis || emphasisIndices.has(index));
          const fontSize = wordStyle.cptPaintedFontSize
            ?? wordStyle.fontSize
            ?? wordStyle.frozenFontSize
            ?? globalStyle?.font_size
            ?? 18;
          const accent = caption.emphasis_color
            || globalStyle?.highlight_color
            || globalStyle?.emphasis_color
            || globalStyle?.secondary_color
            || '#DDAA03';
          const color = isEmphasis
            ? (wordStyle.isEmphasis && wordStyle.color ? wordStyle.color : accent)
            : (wordStyle.color || globalStyle?.text_color || '#ffffff');
          const scaleX = Number(wordStyle.textScaleX || 1) || 1;
          const rotation = Number(wordStyle.rotation || 0) || 0;
          const boxWidth = Number(wordStyle.boxWidth || 0) || 0;
          const inline = [
            'position:absolute',
            'left:' + Number(wordStyle.abs_x_pct) + '%',
            'top:' + Number(wordStyle.abs_y_pct) + '%',
            'transform:translate(-50%,-50%)'
              + (rotation ? ' rotate(' + rotation + 'deg)' : '')
              + (Math.abs(scaleX - 1) > 0.001 ? ' scaleX(' + scaleX + ')' : ''),
            'transform-origin:center center',
            'display:' + (boxWidth ? 'block' : 'inline-block'),
            'z-index:80',
            'white-space:' + (boxWidth ? 'normal' : 'nowrap'),
            'overflow:visible',
            'opacity:' + (index > currentIndex ? '0' : '1'),
            'animation:none',
            'transition:none',
            'font-family:&quot;' + escapeHtml(
              wordStyle.cptPaintedFontFamily
              || wordStyle.fontFamily
              || globalStyle?.font_family
              || 'Inter',
            ) + '&quot;',
            'font-size:' + scaleExportPx(fontSize) + 'px',
            'font-weight:' + (
              wordStyle.cptPaintedFontWeight
              || wordStyle.fontWeight
              || (isEmphasis ? '800' : (globalStyle?.font_weight || '500'))
            ),
            'font-style:' + (
              wordStyle.cptPaintedFontStyle
              || wordStyle.fontStyle
              || globalStyle?.font_style
              || 'normal'
            ),
            'line-height:' + Number(globalStyle?.line_spacing || 1.25),
            'color:' + color + ' !important',
            '-webkit-text-fill-color:' + color + ' !important',
            wordStyle.textDecoration ? 'text-decoration:' + wordStyle.textDecoration : '',
            wordStyle.textTransform ? 'text-transform:' + wordStyle.textTransform : '',
            boxWidth ? 'width:' + scaleExportPx(boxWidth) + 'px' : '',
            boxWidth ? 'overflow-wrap:anywhere' : '',
            boxWidth ? 'text-align:center' : '',
          ].filter(Boolean);
          const effectStyles = getWordEffectInlineStyles(wordStyle);
          const effectInline = inlineStyleObject(effectStyles);
          if (effectInline) inline.push(effectInline);
          if (wordStyle.backgroundColor || wordStyle.highlightGradient) {
            inline.push(
              'background:' + (
                wordStyle.highlightGradient
                || rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6)
              ),
            );
            inline.push('border-radius:' + scaleExportPx(3) + 'px');
            inline.push('padding:' + scaleExportPx(wordStyle.backgroundPadding ?? 2) + 'px ' + scaleExportPx(4) + 'px');
          }
          const textGradient = wordStyle.textGradient || '';
          if (textGradient) {
            inline.push('background-image:' + textGradient);
            inline.push('-webkit-background-clip:text');
            inline.push('background-clip:text');
            inline.push('-webkit-text-fill-color:transparent !important');
          }
          return '<span data-word-key="' + escapeHtml(word.key) + '"'
            + ' data-absolute-cpt-word="true"'
            + ' data-absolute-cpt-emphasis="' + (isEmphasis ? 'true' : 'false') + '"'
            + ' style="' + inline.join(';') + '">'
            + escapeHtml(transformText(word.text, globalStyle))
            + '</span>';
        }).join('')
        + '</div>';
    };

    const updateAbsoluteCptRevealState = (root, caption, time) => {
      if (!root || !caption) return;
      const currentIndex = getCurrentWordIndex(caption, time);
      Array.from(root.querySelectorAll('[data-absolute-cpt-word="true"]'))
        .forEach((word, index) => {
          word.style.setProperty('opacity', index <= currentIndex ? '1' : '0');
        });
    };

    const buildPlainCaptionMarkup = (caption, globalStyle, time) => {
      const words = buildWordMeta(caption);
      const currentIndex = getCurrentWordIndex(caption, time);
      const showInactive = globalStyle?.show_inactive !== false;
      // Words are inline-block spans joined without whitespace, so this margin
      // is the whole inter-word gap. Mirrors the editor preview in
      // VideoPlayer.jsx: 0.18 x base font size + word_spacing x 2.
      const wordSpacing = \`\${scaleExportPx((globalStyle?.font_size || 18) * 0.18 + (globalStyle?.word_spacing ?? 1) * 2)}px\`;

      const isCptCaption = captionHasCptWords(caption);
      const renderPlainWord = (word, index, isLastInLine = false) => {
        if (!showInactive && index > currentIndex) return '';
        const wordStyle = word.style || {};
        const inline = [
          isCptCaption && index > currentIndex ? 'opacity:0' : '',
          'display:inline-block',
          'position:relative',
          \`font-family:"\${wordStyle.fontFamily || globalStyle?.font_family || 'Inter'}"\`,
          \`font-size:\${scaleExportPx((wordStyle.fontSize ?? globalStyle?.font_size ?? 18) * (wordStyle.isEmphasis ? 1.2 : 1))}px\`,
          \`font-weight:\${wordStyle.fontWeight || (wordStyle.isEmphasis ? '700' : (globalStyle?.font_weight || '500'))}\`,
          \`font-style:\${wordStyle.fontStyle || globalStyle?.font_style || 'normal'}\`,
          \`color:\${wordStyle.color || (wordStyle.isEmphasis ? (globalStyle?.highlight_color || globalStyle?.secondary_color) : '') || globalStyle?.text_color || '#ffffff'}\`,
          wordStyle.textDecoration ? \`text-decoration:\${wordStyle.textDecoration}\` : '',
          wordStyle.textTransform ? \`text-transform:\${wordStyle.textTransform}\` : '',
          !isLastInLine ? \`margin-right:\${wordSpacing}\` : '',
        ].filter(Boolean);
        // Not scaleExportPx: that clamps to >= 1px, and zero shadow offsets/blur are authored values.
        const scaleEffectPx = (value) => Math.round((Number(value) || 0) * (window.__exportCanvasScale || 1));
        if (globalStyle?.has_stroke) inline.push(\`-webkit-text-stroke:\${scaleExportPx(globalStyle.stroke_width ?? 1)}px \${globalStyle.stroke_color || '#000000'}\`);
        if (globalStyle?.has_shadow) inline.push(\`text-shadow:\${scaleEffectPx(globalStyle.shadow_offset_x ?? 0)}px \${scaleEffectPx(globalStyle.shadow_offset_y ?? 2)}px \${scaleEffectPx(globalStyle.shadow_blur ?? 4)}px \${globalStyle.shadow_color || '#000000'}\`);
        if (wordStyle.isEmphasis && !globalStyle?.has_shadow) {
          const accent = globalStyle?.highlight_color || globalStyle?.secondary_color || '#DDAA03';
          inline.push(\`text-shadow:0 0 \${scaleEffectPx(18)}px \${accent}99,0 0 \${scaleEffectPx(6)}px \${accent}66\`);
        }
        const wordGradient = wordStyle.textGradient || globalStyle?.text_gradient || '';
        if (wordGradient) {
          inline.push(\`background:\${wordGradient}\`);
          inline.push('background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent');
        }
        if (wordStyle.backgroundColor || wordStyle.highlightGradient) {
          inline.push(\`background:\${wordStyle.highlightGradient || rgbaFromHex(wordStyle.backgroundColor, wordStyle.backgroundOpacity ?? 0.6)}\`);
          inline.push(\`padding:\${scaleExportPx(wordStyle.backgroundPadding ?? 2)}px \${scaleExportPx((wordStyle.backgroundPadding ?? 2) * 2)}px\`);
          inline.push('border-radius:4px');
        }
        Object.entries(getWordEffectInlineStyles(wordStyle)).forEach(([property, value]) => inline.push(\`\${property}:\${value}\`));
        // Escape the attribute: font-family is double-quoted, and a raw quote
        // here ends style="..." early, dropping every later declaration.
        return \`<span data-word-key="\${word.key}" style="\${escapeHtml(inline.join(';'))}">\${escapeHtml(transformText(word.text, globalStyle))}</span>\`;
      };

      let wordCursor = 0;
      const sourceLines = String(caption.text || '')
        .replace(/\\r\\n/g, '\\n')
        .split('\\n')
        .map((line) => line.trim().split(/\\s+/).filter(Boolean));
      const wordMarkup = sourceLines.map((lineWords) => {
        if (!lineWords.length) return '<span style="display:block;min-height:1em"></span>';
        const lineMarkup = lineWords.map((_, lineWordIndex) => {
          const word = words[wordCursor];
          wordCursor += 1;
          return word ? renderPlainWord(word, wordCursor - 1, lineWordIndex === lineWords.length - 1) : '';
        }).filter(Boolean).join('');
        return \`<span style="display:block">\${lineMarkup}</span>\`;
      }).join('');

      const lineAnimation = isCptCaption
        ? 'none'
        : getLineAnimationStyle(caption.animation, caption.animation_speed || 1);
      const captionEffect = inlineStyleObject(getCaptionEffectInlineStyles(globalStyle));
      const captionBackground = globalStyle?.has_background
        ? \`background:\${rgbaFromHex(globalStyle.background_color || '#000000', globalStyle.background_opacity ?? 0.7)};padding:\${scaleExportPx(globalStyle.background_padding ?? 6)}px \${scaleExportPx((globalStyle.background_padding ?? 6) * 2)}px;border-radius:\${scaleExportPx(8)}px;\`
        : globalStyle?.highlight_gradient
          ? \`background:\${globalStyle.highlight_gradient};\`
          : globalStyle?.highlight_color
            ? \`background:\${globalStyle.highlight_color};\`
            : '';
      const captionGradient = \`color:\${globalStyle?.text_color || '#ffffff'};\`;
      const captionBoxWidth = Number(globalStyle?.box_width || 0);

      return \`
        <div dir="auto" class="plain-caption-shell caption-line-animation-shell" data-caption-start="\${Number(caption.start_time ?? 0)}" data-caption-end="\${Number(caption.end_time ?? caption.start_time ?? 0)}" style="display:inline-block;\${captionBoxWidth > 0 ? \`width:\${scaleExportPx(captionBoxWidth)}px;\` : ''}animation:\${lineAnimation};transform-origin:center center;">
          <span class="cap-text" style="
            display:inline-block;
            \${captionBoxWidth > 0 ? 'width:100%;' : ''}
            font-family:'\${globalStyle?.font_family || 'Inter'}';
            font-size:\${scaleExportPx(globalStyle?.font_size ?? 18)}px;
            font-weight:\${globalStyle?.font_weight || '500'};
            font-style:\${globalStyle?.font_style || 'normal'};
            text-align:\${globalStyle?.text_align || 'center'};
            line-height:\${scaleExportPx((globalStyle?.font_size ?? 18) * (globalStyle?.line_spacing ?? 1.4))}px;
            letter-spacing:\${scaleExportPx(globalStyle?.letter_spacing ?? 0)}px;
            text-decoration:\${globalStyle?.text_decoration || 'none'};
            text-transform:\${globalStyle?.text_case || 'none'};
            opacity:\${globalStyle?.text_opacity ?? 1};
            transform:scale(\${globalStyle?.scale ?? 1});
            white-space:pre-wrap;
            overflow-wrap:anywhere;
            \${captionBackground}
            \${captionEffect}
          "><span class="cap-text-content" style="\${captionGradient}">\${wordMarkup}</span></span>
        </div>
      \`;
    };

    const buildTextElementMarkup = (caption, renderIndex) => {
      const custom = caption.custom_style || {};
      let wordIndex = 0;
      const wordMarkup = String(caption.text || '').split(/(\\s+)/).map((part) => {
        if (!part) return '';
        if (/^\\s+$/.test(part)) return escapeHtml(part).replace(/\\n/g, '<br/>');
        const key = \`\${caption.id}-\${wordIndex}\`;
        wordIndex += 1;
        const gradientStyle = custom.text_gradient
          ? \`background:\${custom.text_gradient};background-image:\${custom.text_gradient};background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;\`
          : '';
        return \`<span data-word-key="\${escapeHtml(key)}" style="\${gradientStyle}">\${escapeHtml(part)}</span>\`;
      }).join('');
      const lineAnimation = getLineAnimationStyle(caption.animation, caption.animation_speed || 1);
      const textGradient = \`color:\${custom.text_color || '#ffffff'};\`;
      const effectStyle = inlineStyleObject(getCaptionEffectInlineStyles(custom));
      return \`
        <div dir="auto" class="text-element-shell" data-caption-render-index="\${renderIndex}" style="
          position:absolute;
          left:\${custom.position_x ?? 50}%;
          top:\${custom.position_y ?? 50}%;
          transform:translate(-50%, -50%) rotate(\${custom.rotation ?? 0}deg);
          text-align:\${custom.text_align || 'center'};
          width:\${scaleExportPx(custom.width ?? 300)}px;
          z-index:\${custom.z_index ?? 50};
          pointer-events:none;
        ">
          <span class="caption-line-animation-shell" data-caption-start="\${Number(caption.start_time ?? 0)}" data-caption-end="\${Number(caption.end_time ?? caption.start_time ?? 0)}" style="
            display:block;
            width:100%;
            animation:\${lineAnimation};
            transform-origin:center center;
          ">
          <span class="text-element-content" style="
            display:block;
            width:100%;
            white-space:pre-wrap;
            font-family:'\${custom.font_family || 'Inter'}';
            font-size:\${scaleExportPx(custom.font_size ?? 18)}px;
            font-weight:\${custom.font_weight || '500'};
            font-style:\${custom.font_style || 'normal'};
            text-decoration:\${custom.text_decoration || 'none'};
            text-transform:\${custom.text_transform || 'none'};
            letter-spacing:\${scaleExportPx(custom.letter_spacing ?? 0)}px;
            word-spacing:\${scaleExportPx(custom.word_spacing ?? 0)}px;
            line-height:\${custom.line_spacing ?? 1.4};
            opacity:\${custom.text_opacity ?? 1};
            transform:scale(\${custom.scale ?? 1});
            transform-origin:center center;
            word-break:normal;overflow-wrap:anywhere;
            \${custom.has_background ? \`background:\${rgbaFromHex(custom.background_color || '#000000', custom.background_opacity ?? 0.6)};padding:\${scaleExportPx(custom.background_padding ?? custom.padding ?? 8)}px;border-radius:\${scaleExportPx(custom.border_radius ?? 6)}px;\` : ''}
            \${custom.has_stroke ? \`-webkit-text-stroke:\${scaleExportPx(custom.stroke_width ?? 1)}px \${custom.stroke_color || '#000000'};\` : ''}
            \${custom.has_shadow ? \`text-shadow:\${scaleExportPx(custom.shadow_offset_x ?? 0)}px \${scaleExportPx(custom.shadow_offset_y ?? 2)}px \${scaleExportPx(custom.shadow_blur ?? 4)}px \${custom.shadow_color || '#000000'};\` : ''}
            \${effectStyle}
          "><span class="text-element-text" style="\${textGradient}">\${wordMarkup}</span></span></span>
        </div>
      \`;
    };

    const resetAdvancedTemplateAnimations = () => {
      const blocks = Array.from(document.querySelectorAll('.lekha-applied-advanced-template'))
        .filter((block) => !block.closest('[data-caption-cpt="true"]'));
      blocks.forEach((block) => {
        block.classList.remove('active');
        block.style.transition = 'none';
        block.style.opacity = '0';

        block.querySelectorAll('.cluster-row-top, .cluster-hl, .cluster-row-bot').forEach((element) => {
          element.classList.remove('active');
          element.style.transition = 'none';
        });
      });
      return blocks;
    };

    const normalizeLineText = (value) => String(value || '').replace(/\\s+/g, ' ').trim();

    const collectStyledLineTokens = (container) => {
      const tokens = [];
      const impPattern = /\\b(?:imp-[\\w-]+|is-emphasis)\\b/;
      const visit = (node, inheritedClassName = '') => {
        if (node.nodeType === 3) {
          String(node.nodeValue || '').split(/\\s+/).filter(Boolean).forEach((word) => {
            tokens.push({ text: word, className: inheritedClassName });
          });
          return;
        }
        if (node.nodeType !== 1) return;
        const className = String(node.className || '');
        const nextClassName = impPattern.test(className)
          ? className
          : inheritedClassName;
        Array.from(node.childNodes || []).forEach((child) => visit(child, nextClassName));
      };
      visit(container);
      return tokens;
    };

    const applyPreviewTextLineBreaks = (container, lineTexts) => {
      const tokens = collectStyledLineTokens(container);
      if (!tokens.length) return;
      const requestedWords = lineTexts.flatMap((line) => line.split(/\\s+/).filter(Boolean));
      if (requestedWords.length !== tokens.length) return;
      const sameWords = requestedWords.every((word, index) => word === normalizeLineText(tokens[index]?.text));
      if (!sameWords) return;

      const fragment = document.createDocumentFragment();
      let cursor = 0;
      lineTexts.forEach((lineText) => {
        const line = document.createElement('span');
        line.className = 'lekha-template-preview-line';
        const lineWords = lineText.split(/\\s+/).filter(Boolean);
        lineWords.forEach((_, lineWordIndex) => {
          const token = tokens[cursor];
          if (!token) return;
          if (lineWordIndex > 0) line.appendChild(document.createTextNode(' '));
          if (token.className) {
            const span = document.createElement('span');
            span.className = token.className;
            span.textContent = token.text;
            line.appendChild(span);
          } else {
            line.appendChild(document.createTextNode(token.text));
          }
          cursor += 1;
        });
        fragment.appendChild(line);
      });
      container.classList.add('lekha-template-preview-lines');
      container.replaceChildren(fragment);
    };

    const applyPreviewTemplateLineBreaks = (root, style) => {
      const lineTexts = Array.isArray(style?.preview_template_line_texts)
        ? style.preview_template_line_texts.map(normalizeLineText).filter(Boolean)
        : [];
      if (!lineTexts.length) return;
      const textContainers = Array.from(root.querySelectorAll(
        '.lekha-original-template .hand-txt, '
        + '.lekha-original-template .soft-rise, '
        + '.lekha-original-template .slow-rise',
      ));
      textContainers.forEach((container) => applyPreviewTextLineBreaks(container, lineTexts));

      const containers = Array.from(root.querySelectorAll(
        '.lekha-original-template .kf-line, '
        + '.lekha-original-template .wbw-rise, '
        + '.lekha-original-template .wbw-slide, '
        + '.lekha-original-template .wbw-seq, '
        + '.lekha-original-template .wbw-seq-fade, '
        + '.lekha-original-template .wbw-seq-flip',
      ));
      containers.forEach((container) => {
        const words = Array.from(container.querySelectorAll('.w, .kf-word'));
        if (!words.length) return;
        const existingTexts = words.map((word) => normalizeLineText(word.textContent));
        const requestedWords = lineTexts.flatMap((line) => line.split(/\\s+/).filter(Boolean));
        if (requestedWords.length !== words.length) return;
        const sameWords = requestedWords.every((word, index) => word === existingTexts[index]);
        if (!sameWords) return;

        const fragment = document.createDocumentFragment();
        let cursor = 0;
        lineTexts.forEach((lineText) => {
          const line = document.createElement('span');
          line.className = 'lekha-template-preview-line';
          const lineWords = lineText.split(/\\s+/).filter(Boolean);
          lineWords.forEach((_, lineWordIndex) => {
            if (!words[cursor]) return;
            if (lineWordIndex > 0) line.appendChild(document.createTextNode(' '));
            line.appendChild(words[cursor]);
            cursor += 1;
          });
          fragment.appendChild(line);
        });
        container.classList.add('lekha-template-preview-lines');
        container.replaceChildren(fragment);
      });
    };

    const syncTemplateExportScale = () => {};

    window.__activateTemplateAnimations = async () => {
      const blocks = resetAdvancedTemplateAnimations();
      if (!blocks.length) return;

      void document.body.offsetHeight;
      await new Promise((resolve) => requestAnimationFrame(resolve));

      blocks.forEach((block) => {
        block.style.transition = 'opacity 280ms ease';
        block.style.opacity = '1';
        block.classList.add('active');

        block.querySelectorAll('.cluster-row-top, .cluster-hl, .cluster-row-bot').forEach((element) => {
          element.style.transition = '';
          element.classList.add('active');
        });
      });

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };

    window.__renderPayload = (payload, time) => {
      const root = document.getElementById('overlay-root');
      if (!root) return;
      const style = payload.style || {};
      const resolveCaptionTemplateStyle = (caption) => {
        if (!caption || caption.is_text_element) return style;
        const appliedStyle = caption.applied_template_style || {};
        const captionTemplateId = String(caption.template_id || appliedStyle.template_id || '').trim();
        const globalTemplateId = String(style.template_id || '').trim();
        const globalStyleMatchesTemplate = !captionTemplateId
          || !globalTemplateId
          || captionTemplateId === globalTemplateId;
        const mergedStyle = globalStyleMatchesTemplate
          ? { ...appliedStyle, ...style }
          : { ...style, ...appliedStyle };
        return {
          ...mergedStyle,
          template_id: caption.template_id || mergedStyle.template_id || '',
          template_20_id: caption.template_20_id || mergedStyle.template_20_id || '',
          template_source: caption.template_source || mergedStyle.template_source || '',
          template_class: caption.template_class || mergedStyle.template_class || '',
          template_name: caption.template_name || mergedStyle.template_name || '',
          template_layout: caption.template_layout || mergedStyle.template_layout || '',
          template_effect: caption.template_effect || mergedStyle.template_effect || '',
          template_markup: caption.template_markup || mergedStyle.template_markup || '',
          text_color: caption.text_color || mergedStyle.text_color || '#ffffff',
          text_gradient: caption.text_gradient || mergedStyle.text_gradient || '',
          secondary_color: caption.secondary_color || mergedStyle.secondary_color || '',
          highlight_color: caption.highlight_color || mergedStyle.highlight_color || '',
          highlight_gradient: caption.highlight_gradient || mergedStyle.highlight_gradient || '',
          emphasis_color: caption.emphasis_color || mergedStyle.emphasis_color || '',
          karaoke_color_1: caption.karaoke_color_1 || mergedStyle.karaoke_color_1 || '',
          karaoke_color_2: caption.karaoke_color_2 || mergedStyle.karaoke_color_2 || '',
          karaoke_color_3: caption.karaoke_color_3 || mergedStyle.karaoke_color_3 || '',
          preview_template_font_px: Number(
            caption.preview_template_font_px
            || mergedStyle.preview_template_font_px
            || 0,
          ),
          preview_template_box_width_px: Number(
            caption.preview_template_box_width_px
            || mergedStyle.preview_template_box_width_px
            || 0,
          ),
          preview_template_box_height_px: Number(
            caption.preview_template_box_height_px
            || mergedStyle.preview_template_box_height_px
            || 0,
          ),
          template_color_customized: Boolean(
            caption.template_color_customized
            || mergedStyle.template_color_customized
            || caption.text_gradient
            || mergedStyle.text_gradient
            || caption.highlight_gradient
            || mergedStyle.highlight_gradient
          ),
        };
      };
      const activeCaptions = (payload.captions || []).filter((caption) => {
        const start = Number(caption.start_time ?? 0);
        const end = Number(caption.end_time ?? start);
        return time >= start && time < end;
      });

      const hasActiveSidebarCaption = activeCaptions.some((caption) => Boolean(
        caption?.template_20_id
        || caption?.applied_template_style?.template_20_id
        || style.template_20_id,
      ));
      const activeCaptionSignature = activeCaptions.map((caption) => [
        caption?.id || '',
        Number(caption?.start_time ?? 0),
        Number(caption?.end_time ?? caption?.start_time ?? 0),
      ].join(':')).join('|');
      const canReuseSidebarDom = hasActiveSidebarCaption
        && root.childElementCount > 0
        && root.dataset.activeCaptionSignature === activeCaptionSignature;

      if (!canReuseSidebarDom) {
        root.innerHTML = activeCaptions.map((caption, activeIndex) => {
        if (caption.is_text_element) return buildTextElementMarkup(caption, activeIndex);
        const templateCaptionIndex = Math.max(
          0,
          (payload.captions || [])
            .filter((item) => item && !item.is_text_element)
            .findIndex((item) => item.id === caption.id),
        );
        const captionWithTemplateIndex = {
          ...caption,
          __templateIndex: Number.isFinite(Number(caption.__templateIndex))
            ? Number(caption.__templateIndex)
            : templateCaptionIndex,
        };
        const renderStyle = resolveCaptionTemplateStyle(captionWithTemplateIndex);
        const left = renderStyle.position_x ?? style.position_x ?? 50;
        const top = renderStyle.position_y ?? style.position_y ?? 75;
        const isSidebarTemplate = Boolean(renderStyle.template_20_id);
        const isAbsoluteCpt = captionHasAbsoluteCptLayout(captionWithTemplateIndex);
        const base = isAbsoluteCpt
          ? [
              'position:absolute',
              'inset:0',
              'pointer-events:none',
              'width:100%',
              'height:100%',
            ]
          : isSidebarTemplate
          ? [
              'position:absolute',
              'left:0',
              \`top:\${top}%\`,
              'transform:translateY(-50%)',
              'pointer-events:none',
              'width:100%',
              'display:flex',
              'justify-content:center',
              \`text-align:\${renderStyle.text_align || style.text_align || 'center'}\`,
            ]
          : [
              'position:absolute',
              \`left:\${left}%\`,
              \`top:\${top}%\`,
              'transform:translate(-50%, -50%)',
              'pointer-events:none',
              'width:max-content',
              'max-width:90%',
              \`text-align:\${renderStyle.text_align || style.text_align || 'center'}\`,
            ];
        const isBasicTemplate = Boolean(
          window.__basicTpl
          && window.__basicTpl.isSourceBasicTemplateId
          && window.__basicTpl.isSourceBasicTemplateId(renderStyle.template_id),
        );
        const inner = isAbsoluteCpt
          ? buildAbsoluteCptMarkup(captionWithTemplateIndex, renderStyle, time)
          : isSidebarTemplate
          ? buildSidebarTemplateMarkup(captionWithTemplateIndex, renderStyle)
          : isBasicTemplate
          ? buildBasicTemplateCaptionMarkup(captionWithTemplateIndex, renderStyle, time)
          : renderStyle.template_id
          ? buildTemplateMarkup(captionWithTemplateIndex, renderStyle, time)
          : buildPlainCaptionMarkup(captionWithTemplateIndex, renderStyle, time);
        const shouldWrapTemplateAnimation = Boolean(
          renderStyle.template_id
          && !captionHasCptWords(caption)
          && caption.animation
          && caption.animation !== 'none',
        );
        const animatedInner = shouldWrapTemplateAnimation
          ? \`<div class="caption-line-animation-shell" data-caption-start="\${Number(caption.start_time ?? 0)}" data-caption-end="\${Number(caption.end_time ?? caption.start_time ?? 0)}" style="display:inline-block;animation:\${getLineAnimationStyle(caption.animation, caption.animation_speed || 1)};transform-origin:center center;">\${inner}</div>\`
          : inner;
        return \`<div class="caption-anchor" data-caption-render-index="\${activeIndex}" data-caption-cpt="\${captionHasCptWords(caption) ? 'true' : 'false'}" data-caption-absolute-cpt="\${isAbsoluteCpt ? 'true' : 'false'}" style="\${base.join(';')}">\${animatedInner}</div>\`;
        }).join('');
        root.dataset.activeCaptionSignature = activeCaptionSignature;
      }
      activeCaptions.forEach((caption, activeIndex) => {
        const anchor = root.querySelector(\`[data-caption-render-index="\${activeIndex}"]\`);
        if (!anchor) return;
        const templateCaptionIndex = Math.max(
          0,
          (payload.captions || [])
            .filter((item) => item && !item.is_text_element)
            .findIndex((item) => item.id === caption.id),
        );
        const captionWithTemplateIndex = {
          ...caption,
          __templateIndex: Number.isFinite(Number(caption.__templateIndex))
            ? Number(caption.__templateIndex)
            : templateCaptionIndex,
        };
        const renderStyle = resolveCaptionTemplateStyle(captionWithTemplateIndex);
        applySourceTemplateScriptFonts(anchor, captionWithTemplateIndex.__export_script);
        if (anchor.dataset.captionAbsoluteCpt === 'true') {
          // Sidebar DOM is intentionally reused between sampled frames. Keep
          // the cumulative CPT reveal state moving even though its markup is
          // no longer rebuilt on every frame.
          updateAbsoluteCptRevealState(anchor, captionWithTemplateIndex, time);
        } else {
          applySourceTemplateWordStyles(anchor, captionWithTemplateIndex, time);
        }
        const captionLineTexts = Array.isArray(caption?.preview_template_line_texts)
          && caption.preview_template_line_texts.length > 0
          ? caption.preview_template_line_texts
          : style.preview_template_line_texts;
        const renderedTemplateId = String(renderStyle?.template_id || '').trim();
        // Keyframe templates index words with :nth-of-type inside one line
        // container, so regrouping words into line spans would break them.
        const shouldReplayPreviewLineBreaks = !window.__keyframeAdvancedTemplateIds.has(renderedTemplateId) && (
          !recreatedAdvancedTemplateIds.has(renderedTemplateId)
          || renderedTemplateId === 't24'
          || renderedTemplateId === 't25'
          || renderedTemplateId === 't29'
        );
        if (shouldReplayPreviewLineBreaks) {
          applyPreviewTemplateLineBreaks(anchor, {
            ...style,
            preview_template_line_texts: captionLineTexts,
          });
        }
      });
      activateSidebarTemplateShells(root, time);
      activateBasicTemplates(root);
      activeCaptions.forEach((caption, activeIndex) => {
        const anchor = root.querySelector(\`[data-caption-render-index="\${activeIndex}"]\`);
        if (!anchor || caption?.is_text_element) return;
        if (anchor.dataset.captionAbsoluteCpt === 'true') return;
        applySourceTemplateScriptFonts(anchor, caption.__export_script);
        applySourceTemplateWordStyles(anchor, caption, time);
      });
    };
  `;
}
