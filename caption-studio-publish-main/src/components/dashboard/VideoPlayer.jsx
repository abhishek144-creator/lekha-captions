import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Volume2, VolumeX, X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Grid2X2, Move, RotateCw, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import '../../styles/captionTemplates.css';
import '../../styles/captionTemplatesAdvanced.css';
import '../../styles/advancedTemplateLibrary.css';
import originalTemplateHtml from '../../assets/lekha-captions-T11-T35.html?raw';
import sidebarLegacyTemplateHtml from '../../assets/lekha-captions-20-templates.html?raw';
import sidebarNewTemplateHtml from '../../assets/lekha-captions-49-templates.html?raw';

const ADVANCED_TEMPLATE_VARIANTS = {
  t01: 'wbw-rise', t02: 'plain-s', t03: 'wbw-rise', t04: 'plain-s', t05: 'wbw-rise',
  t06: 'wbw-rise', t07: 'wbw-rise', t08: 'wbw-rise', t09: 'wbw-rise', t10: 'wbw-rise',
  t11: 'wbw-slide', t12: 'plain-s', t13: 'wbw-rise', t14: 'wbw-slide', t15: 'plain-s',
  t16: 'wbw-rise', t17: 'wbw-slide', t18: 'wbw-rise', t19: 'wbw-rise', t20: 'plain-s',
  t21: 'wbw-rise', t22: 'wbw-rise', t23: 'wbw-rise', t24: 'wbw-rise', t25: 'wbw-slide',
  t26: 'wbw-rise', t27: 'plain-s', t28: 'wbw-rise', t29: 'wbw-rise', t30: 'wbw-slide',
  t31: 'wbw-rise', t32: 'plain-s', t33: 'wbw-rise', t34: 'wbw-rise', t35: 'wbw-rise',
  t36: 'plain-s', t37: 'wbw-rise', t38: 'wbw-slide', t39: 'wbw-rise', t40: 'plain-s',
};
const TEMPLATE_CANVAS_FONT_SCALE = 0.88;
const SIDEBAR_TEMPLATE_APPLIED_WIDTH_CAP = 320;
const SIDEBAR_TEMPLATE_APPLIED_HEIGHT_CAP = 280;
const ORIGINAL_TEMPLATE_BLOCK_TYPES = {
  t11: ['styled', 'styled', 'plain', 'wbw-rise'],
  t12: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t13: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t14: ['styled', 'styled', 'plain', 'wbw-rise'],
  t15: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t16: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t17: ['styled', 'styled', 'plain', 'wbw-rise'],
  t18: ['styled', 'styled', 'plain', 'wbw-rise'],
  t19: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t20: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t21: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t22: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t23: ['styled', 'plain', 'plain', 'styled'],
  t24: ['wbw-rise', 'styled', 'plain', 'wbw-rise', 'karaoke'],
  t25: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t26: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t27: ['styled', 'plain', 'plain', 'wbw-rise'],
  t28: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t29: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t30: ['styled', 'plain', 'plain', 'plain'],
  t31: ['styled', 'styled', 'plain', 'wbw-rise'],
  t32: ['styled', 'styled', 'plain', 'wbw-rise'],
  t33: ['styled', 'wbw-seq-fade', 'karaoke', 'wbw-rise', 'styled'],
  t34: ['styled', 'styled', 'wbw-rise', 'wbw-slide'],
  t35: ['styled', 'plain', 'plain', 'plain'],
  t36: ['karaoke', 'karaoke', 'karaoke'],
  t37: ['styled', 'wbw-rise', 'styled', 'wbw-seq'],
  t38: ['plain', 'wbw-slide', 'wbw-rise', 'wbw-seq-fade'],
  t39: ['wbw-seq-fade', 'wbw-seq-fade', 'wbw-seq-fade', 'wbw-seq-fade'],
  t40: ['styled', 'styled', 'plain', 'styled'],
};

function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

function hasSidebarTemplateStyle(style) {
  return !!style?.template_20_id;
}

function getTemplateWrapperClassName(templateId) {
  if (!isAdvancedTemplateId(templateId)) return 'cap-text';
  return templateId;
}

function getTemplateContainerStateClass(templateId) {
  if (templateId === 't-WS1') return 'ws-done';
  return '';
}

function getTemplateVariantClassName(templateId) {
  return ADVANCED_TEMPLATE_VARIANTS[templateId] || 'wbw-rise';
}

function isSourceBasicTemplateId(templateId) {
  return [
    't-106', 't-52', 't-T4', 't-WS1', 't-115',
    't-104', 't-109', 't-95', 't-102', 't-T5',
    't-T6', 't-103', 't-QW1', 't-36', 't-105',
    't-124', 't-110', 't-56', 't-119', 't-12',
  ].includes(String(templateId || ''));
}

function getBasicTemplateWordClassName(templateId, isPast, isCurrent, isEmphasis) {
  return [
    'word',
    'active',
    isPast ? 'done' : '',
    isCurrent ? 'current' : '',
    isEmphasis ? 'imp' : '',
  ].filter(Boolean).join(' ');
}

function scaleTemplateFontSize(fontSize) {
  return Math.max(12, Math.round((fontSize || 18) * TEMPLATE_CANVAS_FONT_SCALE));
}

function splitCaptionForTemplate(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { top: '', hero: '', bottom: '', full: '' };
  if (words.length === 1) {
    return { top: '', hero: words[0], bottom: '', full: words[0] };
  }
  const heroIndex = Math.min(1, words.length - 1);
  return {
    top: words.slice(0, heroIndex).join(' '),
    hero: words[heroIndex] || words[0],
    bottom: words.slice(heroIndex + 1).join(' '),
    full: words.join(' '),
  };
}

function splitTemplateLines(text = '', maxLines = 2) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lineCount = Math.max(1, Math.min(maxLines, words.length));
  const lines = Array.from({ length: lineCount }, () => []);
  words.forEach((word, index) => {
    lines[Math.min(lineCount - 1, Math.floor((index * lineCount) / words.length))].push(word);
  });
  return lines.map(line => line.join(' ')).filter(Boolean);
}

function splitWordsIntoIndexedLines(words = [], maxLines = 2) {
  if (!words.length) return [];
  const lineCount = Math.max(1, Math.min(maxLines, words.length));
  const lines = Array.from({ length: lineCount }, () => []);
  words.forEach((word, wordIndex) => {
    lines[Math.min(lineCount - 1, Math.floor((wordIndex * lineCount) / words.length))].push({ word, wordIndex });
  });
  return lines.filter(line => line.length);
}

function getSidebarTemplateLineCount(style = {}, wordCount = 0) {
  const templateClass = String(style.template_class || style.template_20_id || '').toLowerCase();
  const layout = style.template_layout || '';
  if (wordCount <= 3) return 1;
  if (layout === 'stack') return 3;
  if (layout === 'plain') return Math.min(2, wordCount);
  if (/^(a[145]|b[145]|c[1345]|d[12345]|t0[135789]|t1[1345]|v)/.test(templateClass)) return 3;
  return 2;
}

function getSidebarTemplateMotion(style = {}) {
  const templateClass = String(style.template_class || style.template_20_id || '').toLowerCase();
  const templateEffect = String(style.template_effect || '').toLowerCase();
  const motionKey = `${templateEffect} ${templateClass}`;
  if (/flip|a1|t01|t11|v3/.test(motionKey)) return 'flip';
  if (/slide|slider|a2|t03|t09|v4/.test(motionKey)) return 'slide';
  if (/roll|a5|t14/.test(motionKey)) return 'roll';
  if (/diag|d/.test(motionKey)) return 'diag';
  if (/wipe|stencil/.test(motionKey)) return 'wipe';
  if (/plain/.test(style.template_layout || '')) return 'fade';
  return 'rise';
}

function getSidebarTemplateEntryState(motion = 'rise') {
  switch (motion) {
    case 'flip':
      return {
        opacity: 0,
        transform: 'perspective(320px) rotateX(-90deg)',
        transformOrigin: 'center bottom',
      };
    case 'slide':
      return {
        opacity: 0,
        transform: 'translateX(-16px)',
      };
    case 'roll':
      return {
        opacity: 0,
        transform: 'translateY(14px) rotate(-6deg)',
        transformOrigin: 'left bottom',
      };
    case 'diag':
      return {
        opacity: 0,
        transform: 'translate(-16px, 16px)',
      };
    case 'wipe':
      return {
        opacity: 1,
        transform: 'none',
        clipPath: 'inset(0 100% 0 0)',
      };
    case 'fade':
      return {
        opacity: 0,
        transform: 'none',
      };
    case 'rise':
    default:
      return {
        opacity: 0,
        transform: 'translateY(20px)',
      };
  }
}

function renderTextWithHero(text, className = '') {
  const { top, hero, bottom, full } = splitCaptionForTemplate(text);
  if (!full) return null;
  if (className && hero) {
    return (
      <>
        {top && `${top} `}
        <span className={className}>{hero}</span>
        {bottom && ` ${bottom}`}
      </>
    );
  }
  return full;
}

function renderWbwText(text, variant = 'wbw-rise', impClass = 'imp-bold', active = true) {
  const { hero, full } = splitCaptionForTemplate(text);
  if (!full) return null;
  const tokens = full.split(/\s+/).filter(Boolean).map(word => ({ word }));
  const heroIndex = Math.max(0, tokens.findIndex((token) => token.word === hero));

  return (
    <span className={`${variant} lekha-template-fit`} data-type={variant}>
      {tokens.map((token, index) => (
        <React.Fragment key={`${token.word}-${index}`}>
          {index > 0 && ' '}
          <span
            className={`w${index === heroIndex ? ` ${impClass}` : ''}${active ? ' in' : ''}`}
            data-i={index}
            data-imp={index === heroIndex ? 'true' : undefined}
            data-imp-cls={index === heroIndex ? impClass : undefined}
            style={{ '--wbw-delay': `${index * 65}ms` }}
          >
            {token.word}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

function renderKaraokeText(text) {
  const { full } = splitCaptionForTemplate(text);
  if (!full) return null;
  const words = full.split(/\s+/).filter(Boolean);
  const perWordDuration = Math.max(220, Math.round(1600 / Math.max(1, words.length)));

  return (
    <span className="kf-line lekha-template-fit">
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {index > 0 && ' '}
          <span className="kf-word" style={{ '--kf-delay': `${index * perWordDuration}ms`, '--kf-duration': `${perWordDuration}ms` }}>
            <span className="kf-base">{word}</span>
            <span className="kf-fill">{word}</span>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}
function extractOriginalTemplateRuntimeCss() {
  const style = originalTemplateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
  const startToken = '/* ===== SENTENCE BLOCKS ===== */';
  const start = style.indexOf(startToken);
  if (start < 0) return '';
  return style.slice(start);
}

function extractHtmlStyle(markup = '') {
  return String(markup).match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
}

function escapeTemplateText(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBalancedCaptionBreakIndex(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return -1;

  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 2; i <= words.length - 2; i += 1) {
    const firstLine = words.slice(0, i).join(' ');
    const secondLine = words.slice(i).join(' ');
    const lineLengthGap = Math.abs(firstLine.length - secondLine.length);
    const longestLine = Math.max(firstLine.length, secondLine.length);
    const score = (lineLengthGap * 2) + longestLine;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function sanitizeTemplateInlineStyle(styleValue = '') {
  const allowedDeclarations = String(styleValue)
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const [property = '', rawValue = ''] = declaration.split(':');
      const value = rawValue.trim();
      return property.trim().toLowerCase() === 'animation-delay'
        && /^-?\d*\.?\d+(m?s)$/i.test(value);
    });
  return allowedDeclarations.length ? ` style="${allowedDeclarations.join(';')}"` : '';
}

function sanitizeAppliedTemplateMarkup(markup = '', preserveInlineStyles = false) {
  return String(markup)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+bis_skin_checked="[^"]*"/gi, '')
    .replace(/\sstyle="([^"]*)"/gi, preserveInlineStyles ? (_, styleValue) => sanitizeTemplateInlineStyle(styleValue) : '')
    .replace(/\sclass="([^"]*)"/gi, (_, classValue) => {
      const cleanedClassValue = String(classValue)
        .split(/\s+/)
        .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in'].includes(className))
        .join(' ');
      return cleanedClassValue ? ` class="${cleanedClassValue}"` : '';
    })
    .replace(/\s+data-ti="[^"]*"/gi, '')
    .replace(/\s+data-si="[^"]*"/gi, '');
}

function extractAppliedTemplateDiv(markup = '', startIndex = 0) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(markup))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return markup.slice(startIndex, tagPattern.lastIndex);
  }

  return '';
}

function findAppliedSidebarTemplateMarkup(captionStyle = {}) {
  const className = String(captionStyle?.template_class || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!className) return ''
  const source = captionStyle?.template_source === 'lekha-49'
    ? sidebarNewTemplateHtml
    : sidebarLegacyTemplateHtml
  const cardClassToken = captionStyle?.template_source === 'lekha-49' ? 'lk-card' : 'card'
  const pattern = new RegExp(`<div\\s+[^>]*class="(?=[^"]*\\b${cardClassToken}\\b)(?=[^"]*\\b${className}\\b)[^"]*"`, 'i')
  const match = pattern.exec(source)
  return match ? extractAppliedTemplateDiv(source, match.index) : ''
}

function buildAppliedSidebarTemplateScript({ captionText = '', isNewTemplateSet = false }) {
  return `
    <script>
      (() => {
        const captionText = ${JSON.stringify(captionText)};
        const words = captionText.trim().split(/\\s+/).filter(Boolean);
        const activeBlocks = Array.from(document.querySelectorAll('.sb, .sblock'));
        const dots = Array.from(document.querySelectorAll('.dots i, .lk-dots i'));
        const WBW_STAGGER = ${isNewTemplateSet ? 160 : 120};
        let current = 0;

        function escapeHtml(value) {
          return String(value).replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          }[char]));
        }

        function cleanClassName(value, fallback) {
          const cleaned = String(value || '')
            .split(/\\s+/)
            .filter((className) => className && !['active', 'visible', 'anim', 'on', 'in'].includes(className))
            .join(' ');
          return cleaned || fallback;
        }

        function mappedTemplateClass(sourceClasses, index, total, fallback) {
          if (!sourceClasses.length) return fallback;
          if (total <= 1) return sourceClasses[0] || fallback;
          const sourceIndex = Math.min(
            sourceClasses.length - 1,
            Math.round((index * (sourceClasses.length - 1)) / Math.max(1, total - 1))
          );
          return sourceClasses[sourceIndex] || fallback;
        }

        function splitWordsForSlots(slotCount) {
          if (!words.length || !slotCount) return [];
          const slots = Array.from({ length: slotCount }, () => []);
          words.forEach((word, index) => {
            slots[Math.min(slotCount - 1, Math.floor((index * slotCount) / words.length))].push(word);
          });
          return slots.map((slot) => slot.join(' '));
        }

        function replaceWordByWord(container) {
          if (!container || !words.length) return false;
          const isNewWbw = container.classList.contains('wbw-line');
          const selector = isNewWbw ? '.wbw-word' : '.w';
          const fallback = isNewWbw ? 'wbw-word normal' : 'w';
          const sourceClasses = Array.from(container.querySelectorAll(selector))
            .map((word) => cleanClassName(word.className, fallback));

          container.innerHTML = words.map((word, index) => (
            '<span class="' + mappedTemplateClass(sourceClasses, index, words.length, fallback) + '">' + escapeHtml(word) + '</span>'
          )).join(' ');
          return true;
        }

        function replaceSticky(container) {
          const stickyWords = Array.from(container.querySelectorAll('.sw-w'));
          if (!stickyWords.length || !words.length) return false;
          const sourceClasses = stickyWords.map((word) => cleanClassName(word.className, 'sw-w'));
          container.innerHTML = words.map((word, index) => (
            '<span class="' + mappedTemplateClass(sourceClasses, index, words.length, 'sw-w') + '">' + escapeHtml(word) + '</span>'
          )).join(' ');
          return true;
        }

        function replacePositioned(block) {
          const spans = Array.from(block.querySelectorAll('.sw'));
          if (!spans.length || !words.length) return false;
          const chunks = splitWordsForSlots(spans.length);
          spans.forEach((span, index) => {
            const text = chunks[index] || '';
            span.textContent = text;
            span.style.display = text ? '' : 'none';
          });
          return true;
        }

        function replacePlain(block) {
          const plain = Array.from(block.querySelectorAll('.plain-s'))
            .find((element) => !element.classList.contains('wbw') && !element.classList.contains('wbw-line'));
          if (!plain || !words.length) return false;
          plain.textContent = captionText;
          return true;
        }

        function replaceTemplateText(block) {
          block.querySelectorAll('.wbw, .wbw-line').forEach(replaceWordByWord);
          block.querySelectorAll('.sw-line').forEach(replaceSticky);
          replacePositioned(block);
          replacePlain(block);
        }

        function getWordMotion(parent) {
          const classes = parent ? parent.classList : { contains: () => false };
          if (classes.contains('wslide') || classes.contains('wbw-slide')) return { transform: 'translateX(-26px)', opacity: '0' };
          if (classes.contains('wslider')) return { transform: 'translateX(26px)', opacity: '0' };
          if (classes.contains('wroll')) return { transform: 'translateY(14px) rotate(-6deg)', opacity: '0', origin: 'left bottom' };
          if (classes.contains('wwipe')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 100% 0 0)' };
          if (classes.contains('wwipeup')) return { transform: 'none', opacity: '1', clipPath: 'inset(100% 0 0 0)' };
          if (classes.contains('wfade')) return { transform: 'none', opacity: '0' };
          if (classes.contains('wscale')) return { transform: 'scale(0.5)', opacity: '0' };
          if (classes.contains('wflip')) return { transform: 'rotateX(-80deg)', opacity: '0', origin: 'center bottom' };
          if (classes.contains('wbounce')) return { transform: 'translateY(-22px)', opacity: '0' };
          if (classes.contains('wdiag')) return { transform: 'translate(-16px,16px)', opacity: '0' };
          if (classes.contains('wexpand')) return { transform: 'scaleX(0.15)', opacity: '0', origin: 'center' };
          if (classes.contains('wskew')) return { transform: 'skewX(-18deg) translateX(-12px)', opacity: '0' };
          if (classes.contains('wstencil')) return { transform: 'none', opacity: '1', clipPath: 'inset(0 50% 0 50%)' };
          if (classes.contains('wlift')) return { transform: 'translateY(-22px)', opacity: '0' };
          return { transform: 'translateY(22px)', opacity: '0' };
        }

        function resetWord(word) {
          const motion = getWordMotion(word.parentElement);
          word.classList.remove('visible', 'anim', 'in');
          word.style.transition = 'none';
          word.style.opacity = motion.opacity;
          word.style.transform = motion.transform;
          word.style.clipPath = motion.clipPath || '';
          word.style.transformOrigin = motion.origin || '';
        }

        function animateWords(block) {
          const wordNodes = Array.from(block.querySelectorAll('.w, .wbw-word'));
          wordNodes.forEach(resetWord);
          void block.offsetWidth;
          wordNodes.forEach((word, index) => {
            const motion = getWordMotion(word.parentElement);
            const usesClip = !!motion.clipPath;
            const duration = /\\b(imp-|ns[23]-)/.test(word.className) ? 440 : 320;
            setTimeout(() => {
              word.style.transition = usesClip
                ? 'clip-path ' + duration + 'ms cubic-bezier(0.22,1,0.36,1)'
                : 'transform ' + duration + 'ms cubic-bezier(0.22,1,0.36,1), opacity ' + Math.max(240, duration - 60) + 'ms ease';
              word.style.opacity = '1';
              word.style.transform = 'none';
              word.style.clipPath = 'inset(0 0 0 0)';
              word.classList.add(word.classList.contains('wbw-word') ? 'visible' : 'in');
              if (/\\b(ns[23]-|imp-)/.test(word.className)) {
                word.classList.add('anim');
                setTimeout(() => word.classList.remove('anim'), 680);
              }
            }, index * WBW_STAGGER);
          });
        }

        function getSwMotion(element) {
          const key = element.dataset.anim || Array.from(element.classList).find((className) => (
            /^(rise|slide-l|slide-r|slide-slow|fade|wipe|reveal-up|diagonal-wipe|pop|zoom-out|rotate-in|roll|forge|unfold)$/.test(className)
          )) || 'fade';
          if (/slide-l|slide-slow/.test(key)) return { transform: 'translateX(-28px)', opacity: '0' };
          if (/slide-r/.test(key)) return { transform: 'translateX(28px)', opacity: '0' };
          if (/rise/.test(key)) return { transform: 'translateY(20px)', opacity: '0' };
          if (/pop|zoom-out/.test(key)) return { transform: 'scale(0.82)', opacity: '0' };
          if (/rotate|roll/.test(key)) return { transform: 'rotateX(-80deg)', opacity: '0', origin: 'center bottom' };
          if (/wipe|reveal|forge|unfold|diagonal/.test(key)) return { transform: 'none', opacity: '1', clipPath: /diagonal/.test(key) ? 'polygon(0 0,0 0,0 100%,0 100%)' : 'inset(0 100% 0 0)' };
          return { transform: 'none', opacity: '0' };
        }

        function resetSw(element) {
          const motion = getSwMotion(element);
          element.classList.remove('in');
          element.style.transition = 'none';
          element.style.opacity = motion.opacity;
          element.style.transform = motion.transform;
          element.style.transformOrigin = motion.origin || '';
          element.style.clipPath = motion.clipPath || '';
        }

        function animatePositioned(block) {
          const swNodes = Array.from(block.querySelectorAll('.sw'));
          swNodes.forEach(resetSw);
          void block.offsetWidth;
          swNodes.forEach((element, index) => {
            setTimeout(() => {
              element.style.transition = 'transform 360ms cubic-bezier(0.22,1,0.36,1), opacity 320ms ease, clip-path 420ms cubic-bezier(0.22,1,0.36,1)';
              element.style.opacity = '1';
              element.style.transform = 'none';
              element.style.clipPath = 'inset(0 0 0 0)';
              element.classList.add('in');
            }, index * 120);
          });
        }

        function animateSticky(block) {
          const stickyWords = Array.from(block.querySelectorAll('.sw-w'));
          stickyWords.forEach((word) => { word.style.opacity = '0.14'; });
          stickyWords.forEach((word, index) => {
            setTimeout(() => { word.style.opacity = '1'; }, index * 190);
          });
        }

        function restartNewTemplateCssAnimations(block) {
          block.querySelectorAll('.sw').forEach((element) => {
            const clone = element.cloneNode(true);
            element.parentNode.replaceChild(clone, element);
          });

          const words = Array.from(block.querySelectorAll('.wbw-word'));
          words.forEach((word) => {
            word.style.transition = 'none';
            word.classList.remove('visible', 'anim');
          });
          void block.offsetWidth;
          words.forEach((word) => { word.style.transition = ''; });
          words.forEach((word, index) => {
            setTimeout(() => {
              word.classList.add('visible');
              if (/\\bns[23]-/.test(word.className)) {
                word.classList.add('anim');
                setTimeout(() => word.classList.remove('anim'), 650);
              }
            }, index * WBW_STAGGER);
          });

          animateSticky(block);
        }

        function hideBlock(block) {
          block.classList.remove('active');
          block.style.opacity = '0';
          block.style.visibility = 'hidden';
          block.style.zIndex = '0';
          if (${isNewTemplateSet}) {
            block.querySelectorAll('.wbw-word').forEach((word) => {
              word.style.transition = 'none';
              word.classList.remove('visible', 'anim');
            });
            block.querySelectorAll('.sw-w').forEach((word) => { word.style.opacity = '0.14'; });
            return;
          }
          block.querySelectorAll('.w, .wbw-word').forEach(resetWord);
          block.querySelectorAll('.sw').forEach(resetSw);
        }

        function showPhase(index) {
          if (!activeBlocks.length) return;
          activeBlocks.forEach(hideBlock);
          const block = activeBlocks[index % activeBlocks.length];
          if (!block) return;
          block.style.visibility = 'visible';
          block.style.zIndex = '2';
          block.style.opacity = '1';
          block.classList.add('active');
          if (${isNewTemplateSet}) {
            restartNewTemplateCssAnimations(block);
          } else {
            animateWords(block);
            animatePositioned(block);
            animateSticky(block);
          }
          dots.forEach((dot, dotIndex) => { dot.className = dotIndex === index ? 'on' : ''; });
        }

        activeBlocks.forEach(replaceTemplateText);
        showPhase(0);
        if (activeBlocks.length > 1) {
          setInterval(() => {
            current = (current + 1) % activeBlocks.length;
            showPhase(current);
          }, Number(activeBlocks[0]?.dataset?.dur || ${isNewTemplateSet ? 3200 : 2800}));
        }
      })();
    </script>
  `;
}

function buildAppliedSidebarTemplateDoc({ captionText = '', captionStyle = {}, previewScale = 1 }) {
  const isNewTemplateSet = captionStyle?.template_source === 'lekha-49';
  const sourceCss = isNewTemplateSet
    ? extractHtmlStyle(sidebarNewTemplateHtml)
    : extractHtmlStyle(sidebarLegacyTemplateHtml);
  const cardMarkup = sanitizeAppliedTemplateMarkup(
    captionStyle?.template_markup || findAppliedSidebarTemplateMarkup(captionStyle),
    isNewTemplateSet,
  );

  if (!cardMarkup) return '';
  const runtimeScript = buildAppliedSidebarTemplateScript({ captionText, isNewTemplateSet });

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${sourceCss}

          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            overflow: hidden;
            background: transparent !important;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .card,
          .lk-card {
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            aspect-ratio: auto !important;
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            overflow: hidden !important;
            display: block !important;
          }

          .lk-card {
            display: grid !important;
            grid-template-rows: 1fr !important;
          }

          .card-top,
          .dots,
          .lk-card-top,
          .lk-dots,
          .slbl,
          .lk-lbl,
          .stage-lbl,
          .lk-phase-chip {
            display: none !important;
          }

          .stage,
          .lk-stage {
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            border: 0 !important;
            background: transparent !important;
            overflow: hidden !important;
          }

          .card[class] .stage,
          .lk-card[class] .lk-stage {
            background: transparent !important;
            box-shadow: none !important;
          }

          .sb,
          .sblock {
            opacity: 0 !important;
            pointer-events: none !important;
            background: transparent !important;
            visibility: hidden;
          }

          .sb.active,
          .sblock.active {
            opacity: 1 !important;
            visibility: visible;
          }

          .w,
          .wbw-word,
          .sw,
          .sw-w {
            display: inline-block;
            backface-visibility: hidden;
            will-change: transform, opacity, clip-path;
          }
        </style>
      </head>
      <body>
        ${cardMarkup}
        ${runtimeScript}
      </body>
    </html>`;
}

function OriginalAdvancedTemplateStyles() {
  return (
    <style>
      {`
        ${extractOriginalTemplateRuntimeCss()}

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
          width: auto;
          max-width: min(82vw, 360px);
          color: #fff;
          text-align: center;
          pointer-events: auto;
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
          opacity: 1 !important;
          padding: 0 !important;
          overflow: visible !important;
          white-space: normal;
        }

        .lekha-original-template .lekha-template-fit {
          display: inline-block;
          max-width: 100%;
        }

        .lekha-original-template .cluster-wrap {
          align-items: stretch;
        }

        .lekha-original-template .t11-b0 .cluster-hl {
          font-size: 0.72em !important;
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

        .lekha-original-template .kf-line {
          display: inline-block;
          max-width: 100%;
          text-align: center;
          white-space: normal;
        }

        .lekha-original-template .kf-word {
          display: inline-block;
          position: relative;
          white-space: pre;
        }

        .lekha-original-template .kf-base {
          display: block;
          color: rgba(255, 255, 255, 0.25) !important;
          -webkit-text-fill-color: rgba(255, 255, 255, 0.25) !important;
        }

        .lekha-original-template .kf-fill {
          position: absolute;
          inset: 0;
          display: block;
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
          color: #FFE600 !important;
          -webkit-text-fill-color: #FFE600 !important;
        }

        .lekha-original-template .t36-b1 .kf-fill {
          color: #22d3ee !important;
          -webkit-text-fill-color: #22d3ee !important;
        }

        .lekha-original-template .t36-b2 .kf-fill {
          color: #fb923c !important;
          -webkit-text-fill-color: #fb923c !important;
        }

        .lekha-original-template .lekha-applied-advanced-template.active .karaoke-base {
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
          opacity: 1 !important;
        }

        @keyframes lekhaKaraokeFill {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0% 0 0); }
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

        .lekha-original-template.t21-stage,
        .lekha-original-template.t21-stage *,
        .lekha-original-template.t21-stage .w.in,
        .lekha-original-template.t21-stage .imp-italic,
        .lekha-original-template.t21-stage .imp-weight {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .lekha-original-template.t37-stage .imp-green,
        .lekha-original-template.t37-stage .w.in[data-imp='true'] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          text-shadow: 0 0 12px rgba(255,255,255,0.55) !important;
        }

        .t21 .word,
        .t21 .word.active,
        .t21 .word.current,
        .t21 .word.done,
        .t21 .word.imp {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          opacity: 1 !important;
        }

        .t37 .word.current,
        .t37 .word.imp.active,
        .t37 .word.imp.current {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .lekha-original-template.t12-stage .imp-purple {
          color: var(--rose) !important;
          -webkit-text-fill-color: var(--rose) !important;
        }

        .lekha-original-template.t18-stage .imp-purple {
          color: var(--gold) !important;
          -webkit-text-fill-color: var(--gold) !important;
        }

        .lekha-original-template.t24-stage .imp-purple {
          color: #f97316 !important;
          -webkit-text-fill-color: #f97316 !important;
        }

        .lekha-original-template.t32-stage .imp-purple {
          color: var(--cyan) !important;
          -webkit-text-fill-color: var(--cyan) !important;
        }

        .lekha-original-template .t23-b3.active .punch-txt {
          animation: punchPop 0.4s cubic-bezier(0.34,1.7,0.64,1) 0.2s forwards;
        }

        @keyframes lekhaTemplateWbwIn {
          to {
            opacity: 1;
            transform: none;
            clip-path: inset(0 0 0 0);
          }
        }
      `}
    </style>
  );
}

function SidebarSourceTemplateStyles() {
  return (
    <style>
      {`
        .lekha-sidebar-source-template {
          --sidebar-source-accent: #FFE600;
          --sidebar-source-muted: rgba(255, 255, 255, 0.58);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: auto !important;
          height: auto !important;
          max-width: min(84vw, 430px);
          min-width: 0 !important;
          min-height: 0 !important;
          aspect-ratio: auto !important;
          overflow: visible !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: var(--sidebar-source-color, #fff);
          text-align: center;
          pointer-events: auto;
        }

        .lekha-sidebar-source-template .stage,
        .lekha-sidebar-source-template .lk-stage {
          position: relative !important;
          inset: auto !important;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          overflow: visible !important;
          background: transparent !important;
        }

        .lekha-sidebar-source-template .sb,
        .lekha-sidebar-source-template .sblock {
          position: relative !important;
          inset: auto !important;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          padding: 0 !important;
          opacity: 1 !important;
          overflow: visible !important;
          background: transparent !important;
          pointer-events: auto;
        }

        .lekha-sidebar-source-template .wbw,
        .lekha-sidebar-source-template .wbw-line {
          display: inline-block;
          max-width: min(84vw, 430px);
          line-height: var(--sidebar-source-line-height, 1.25);
          text-align: center;
          white-space: normal;
        }

        .lekha-sidebar-source-template .w,
        .lekha-sidebar-source-template .wbw-word {
          display: inline-block;
          vertical-align: baseline;
          color: inherit;
          -webkit-text-fill-color: currentColor;
          opacity: 0;
          transform: translateY(22px);
          transform-origin: center center;
          clip-path: inset(0 0 0 0);
          animation: lekhaSidebarSourceWordIn var(--sidebar-source-word-duration, 330ms) cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: var(--sidebar-source-word-delay, 0ms);
          will-change: transform, opacity, clip-path;
        }

        .lekha-sidebar-source-template .wbw.wrise .w,
        .lekha-sidebar-source-template .wbw-line.wrise .wbw-word {
          transform: translateY(22px);
        }

        .lekha-sidebar-source-template .wbw.wslide .w,
        .lekha-sidebar-source-template .wbw-line.wslide .wbw-word {
          transform: translateX(-26px);
        }

        .lekha-sidebar-source-template .wbw.wslider .w,
        .lekha-sidebar-source-template .wbw-line.wslider .wbw-word {
          transform: translateX(26px);
        }

        .lekha-sidebar-source-template .wbw.wroll .w,
        .lekha-sidebar-source-template .wbw-line.wroll .wbw-word {
          transform: translateY(14px) rotate(-6deg);
          transform-origin: left bottom;
        }

        .lekha-sidebar-source-template .wbw.wwipe .w,
        .lekha-sidebar-source-template .wbw-line.wwipe .wbw-word {
          opacity: 1;
          transform: none;
          clip-path: inset(0 100% 0 0);
        }

        .lekha-sidebar-source-template .wbw.wwipeup .w,
        .lekha-sidebar-source-template .wbw-line.wwipeup .wbw-word {
          opacity: 1;
          transform: none;
          clip-path: inset(100% 0 0 0);
        }

        .lekha-sidebar-source-template .wbw.wfade .w,
        .lekha-sidebar-source-template .wbw-line.wfade .wbw-word {
          transform: none;
        }

        .lekha-sidebar-source-template .wbw.wscale .w,
        .lekha-sidebar-source-template .wbw-line.wscale .wbw-word {
          transform: scale(0.5);
        }

        .lekha-sidebar-source-template .wbw.wflip,
        .lekha-sidebar-source-template .wbw-line.wflip {
          perspective: 320px;
        }

        .lekha-sidebar-source-template .wbw.wflip .w,
        .lekha-sidebar-source-template .wbw-line.wflip .wbw-word {
          transform: rotateX(-80deg);
          transform-origin: center bottom;
        }

        .lekha-sidebar-source-template .wbw.wbounce .w,
        .lekha-sidebar-source-template .wbw-line.wbounce .wbw-word {
          transform: translateY(-22px);
        }

        .lekha-sidebar-source-template .wbw.wdiag .w,
        .lekha-sidebar-source-template .wbw-line.wdiag .wbw-word {
          transform: translate(-16px, 16px);
        }

        .lekha-sidebar-source-template .wbw.wexpand .w,
        .lekha-sidebar-source-template .wbw-line.wexpand .wbw-word {
          transform: scaleX(0.15);
          transform-origin: center;
        }

        .lekha-sidebar-source-template .wbw.wskew .w,
        .lekha-sidebar-source-template .wbw-line.wskew .wbw-word {
          transform: skewX(-18deg) translateX(-12px);
        }

        .lekha-sidebar-source-template .wbw.wstencil .w,
        .lekha-sidebar-source-template .wbw-line.wstencil .wbw-word {
          opacity: 1;
          transform: none;
          clip-path: inset(0 50% 0 50%);
        }

        .lekha-sidebar-source-template .wbw.wlift .w,
        .lekha-sidebar-source-template .wbw-line.wlift .wbw-word {
          transform: translateY(-22px);
        }

        .lekha-sidebar-source-template .w.in,
        .lekha-sidebar-source-template .wbw-word.visible {
          opacity: 1;
        }

        .lekha-sidebar-source-template .w.is-current,
        .lekha-sidebar-source-template .wbw-word.is-current {
          color: var(--sidebar-source-accent);
          -webkit-text-fill-color: currentColor;
        }

        .lekha-sidebar-source-template .w.is-emphasis,
        .lekha-sidebar-source-template .wbw-word.is-emphasis,
        .lekha-sidebar-source-template .imp-gold,
        .lekha-sidebar-source-template .ns2-gold,
        .lekha-sidebar-source-template .ns3-gold {
          color: var(--sidebar-source-accent) !important;
          -webkit-text-fill-color: currentColor !important;
          text-shadow: 0 0 14px color-mix(in srgb, var(--sidebar-source-accent) 48%, transparent);
        }

        .lekha-sidebar-source-template .ns2-rose,
        .lekha-sidebar-source-template .ns3-rose,
        .lekha-sidebar-source-template .imp-rose {
          color: #ff3d71 !important;
          -webkit-text-fill-color: currentColor !important;
        }

        .lekha-sidebar-source-template .ns2-cyan,
        .lekha-sidebar-source-template .ns3-cyan,
        .lekha-sidebar-source-template .imp-cyan {
          color: #00e5ff !important;
          -webkit-text-fill-color: currentColor !important;
        }

        .lekha-sidebar-source-template .ns2-purple,
        .lekha-sidebar-source-template .ns3-purple,
        .lekha-sidebar-source-template .imp-purple {
          color: #a78bfa !important;
          -webkit-text-fill-color: currentColor !important;
        }

        @keyframes lekhaSidebarSourceWordIn {
          to {
            opacity: 1;
            transform: none;
            clip-path: inset(0 0 0 0);
          }
        }
      `}
    </style>
  );
}

function renderOriginalTemplateCaption(templateId, text, active = true, blockIndex = 0) {
  const { top, hero, bottom, full } = splitCaptionForTemplate(text);
  const blockTypes = ORIGINAL_TEMPLATE_BLOCK_TYPES[templateId] || ['styled'];
  const normalizedBlockIndex = ((blockIndex % blockTypes.length) + blockTypes.length) % blockTypes.length;
  const blockType = blockTypes[normalizedBlockIndex];
  const activeClass = active ? ' active' : '';
  const lines2 = splitTemplateLines(full, 2);
  const lines3 = splitTemplateLines(full, 3);
  const upperFull = full.toUpperCase();

  const wrap = (blockClass, children, extraStyle = {}) => (
    <>
      <OriginalAdvancedTemplateStyles />
      <span className={`lekha-original-template ${templateId} ${templateId}-stage`}>
        <span
          className={`sblock ${templateId}-block ${blockClass}${activeClass} lekha-applied-advanced-template`}
          data-template-block-index={normalizedBlockIndex}
          data-template-block-type={blockType}
          style={{
            opacity: 1,
            transition: active ? 'opacity 280ms ease' : 'none',
            ...extraStyle,
          }}
        >
          {children}
        </span>
      </span>
    </>
  );

  switch (templateId) {
    case 't11': {
      if (normalizedBlockIndex === 1) return wrap('t11-b1', <span className="blur-txt lekha-template-fit">{renderTextWithHero(full, 'imp-italic')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t11-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t11-b3', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      return wrap('t11-b0', (
        <span className="cluster-wrap lekha-template-fit">
          <span className={`cluster-row-top${active ? ' active' : ''}`} style={{ textAlign: 'right' }}>{top || lines2[0]}</span>
          <span className={`cluster-hl imp-gold${active ? ' active' : ''}`}>{hero}</span>
          <span className={`cluster-row-bot${active ? ' active' : ''}`} style={{ textAlign: 'left' }}>{bottom || lines2[1] || ''}</span>
        </span>
      ));
    }
    case 't12':
      if (normalizedBlockIndex === 1) return wrap('t12-b1', <span className="rise-unit lekha-template-fit">{renderTextWithHero(full, 'imp-purple')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t12-b2', renderWbwText(full, 'wbw-rise', 'imp-italic', active));
      if (normalizedBlockIndex === 3) return wrap('t12-b3', renderWbwText(full, 'wbw-slide', 'imp-rose', active));
      return wrap('t12-b0', <span className="type-wrap lekha-template-fit">{full}</span>);
    case 't13':
      if (normalizedBlockIndex === 1) return wrap('t13-b1', <span className="ticker-txt lekha-template-fit">{upperFull}</span>);
      if (normalizedBlockIndex === 2) return wrap('t13-b2', renderWbwText(full, 'wbw-rise', 'imp-cyan', active));
      if (normalizedBlockIndex === 3) return wrap('t13-b3', renderWbwText(full, 'wbw-slide', 'imp-bold', active));
      return wrap('t13-b0', <span className="stamp-txt lekha-template-fit">{upperFull}</span>);
    case 't14':
      if (normalizedBlockIndex === 1) return wrap('t14-b1', <span className="drop-txt lekha-template-fit">{renderTextWithHero(full, 'imp-gold')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t14-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t14-b3', renderWbwText(full, 'wbw-rise', 'imp-weight', active));
      return wrap('t14-b0', (
        <span style={{ perspective: '600px' }} className="lekha-template-fit">
          {lines2.map((line, index) => (
            <span key={line} className="flip-line" style={{ animationDelay: `${index * 0.1}s` }}>
              {index === lines2.length - 1 ? renderTextWithHero(line, 'imp-underline') : line}
            </span>
          ))}
        </span>
      ));
    case 't15':
      if (normalizedBlockIndex === 1) return wrap('t15-b1', <span className="pop-txt lekha-template-fit">{upperFull}</span>);
      if (normalizedBlockIndex === 2) return wrap('t15-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t15-b3', renderWbwText(full, 'wbw-slide', 'imp-rose', active));
      return wrap('t15-b0', (
        <span className="shake-in lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br />{renderTextWithHero(lines2[1], 'imp-rose')}</>}
        </span>
      ));
    case 't16':
      if (normalizedBlockIndex === 1) {
        return wrap('t16-b1', <span className="neon-line lekha-template-fit">{full}</span>);
      }
      if (normalizedBlockIndex === 2) return wrap('t16-b2', renderWbwText(full, 'wbw-rise', 'imp-cyan', active));
      if (normalizedBlockIndex === 3) return wrap('t16-b3', renderWbwText(full, 'wbw-slide', 'imp-bold', active));
      return wrap('t16-b0', (
        <span className="lekha-template-fit">
          {lines3.map((line, index) => (
            <span
              key={`${line}-${index}`}
              className="stack-line"
              style={index === lines3.length - 1 ? { color: '#fff', fontWeight: 900 } : undefined}
            >
              {String(index + 1).padStart(2, '0')}. {index === lines3.length - 1 ? renderTextWithHero(line, 'imp-cyan') : line}
            </span>
          ))}
        </span>
      ));
    case 't17':
      if (normalizedBlockIndex === 1) {
        return wrap('t17-b1', (
          <span className="letter-snap-blk lekha-template-fit">
            <span className="snap-txt" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem', color: 'rgba(255,61,113,0.8)' }}>{full}</span>
          </span>
        ));
      }
      if (normalizedBlockIndex === 2) return wrap('t17-b2', <span className="lekha-template-fit" style={{ color: 'rgba(255,255,255,0.4)' }}>{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t17-b3', renderWbwText(full, 'wbw-rise', 'imp-flicker', active));
      return wrap('t17-b0', <span className="glitch-wrap lekha-template-fit" data-text={upperFull}>{upperFull}</span>);
    case 't18':
      if (normalizedBlockIndex === 1) return wrap('t18-b1', <span className="reveal-txt lekha-template-fit">{renderTextWithHero(full, 'imp-purple')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t18-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t18-b3', renderWbwText(full, 'wbw-rise', 'imp-purple', active));
      return wrap('t18-b0', (
        <span className="split-title lekha-template-fit">
          <span className="split-top">{top || lines2[0] || ''}</span>
          <span className="split-bot">{hero ? <span className="imp-purple">{hero}</span> : (bottom || lines2[1] || '')}</span>
        </span>
      ));
    case 't19':
      if (normalizedBlockIndex === 1) return wrap('t19-b1', <span className="rise-unit lekha-template-fit">{renderTextWithHero(upperFull, 'imp-rose')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t19-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t19-b3', renderWbwText(full, 'wbw-slide', 'imp-rose', active));
      return wrap('t19-b0', <span className="slash-wrap lekha-template-fit">{upperFull}</span>);
    case 't20':
      if (normalizedBlockIndex === 1) return wrap('t20-b1', <span className="impact-txt lekha-template-fit">{renderTextWithHero(full, 'imp-green')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t20-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t20-b3', renderWbwText(full, 'wbw-slide', 'imp-green', active));
      return wrap('t20-b0', <span className="neon-drop lekha-template-fit">{upperFull}</span>);
    case 't21':
      if (normalizedBlockIndex === 1) return wrap('t21-b1', <span className="space-txt lekha-template-fit">{renderTextWithHero(full, 'imp-space')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t21-b2', renderWbwText(full, 'wbw-rise', 'imp-italic', active));
      if (normalizedBlockIndex === 3) return wrap('t21-b3', renderWbwText(full, 'wbw-slide', 'imp-weight', active));
      return wrap('t21-b0', <span className="vert-line"><span className="vert-line-inner">{upperFull}</span></span>);
    case 't22':
      if (normalizedBlockIndex === 1) return wrap('t22-b1', <span className="wave-txt lekha-template-fit">{renderTextWithHero(full, 'imp-gold')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t22-b2', renderWbwText(full, 'wbw-rise', 'imp-italic', active));
      if (normalizedBlockIndex === 3) return wrap('t22-b3', renderWbwText(full, 'wbw-slide', 'imp-gold', active));
      return wrap('t22-b0', renderKaraokeText(full));
    case 't23':
      if (normalizedBlockIndex === 1) return wrap('t23-b1', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 2) return wrap('t23-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t23-b3', <span className="punch-txt lekha-template-fit">{renderTextWithHero(full, 'imp-gold')}</span>);
      return wrap('t23-b0', <span className="setup-txt lekha-template-fit">{full}</span>);
    case 't24':
      if (normalizedBlockIndex === 1) return wrap('t24-b1', <span className="slow-rise lekha-template-fit">{renderTextWithHero(full, 'imp-purple')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t24-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t24-b3', renderWbwText(full, 'wbw-rise', 'imp-purple', active));
      if (normalizedBlockIndex === 4) return wrap('t24-b4', renderKaraokeText(full));
      return wrap('t24-b0', (
        renderWbwText(full, 'wbw-rise', 'imp-orange', active)
      ));
    case 't25':
      if (normalizedBlockIndex === 1) return wrap('t25-b1', <span className="soft-rise lekha-template-fit">{renderTextWithHero(full, 'imp-italic')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t25-b2', renderWbwText(full, 'wbw-rise', 'imp-rose', active));
      if (normalizedBlockIndex === 3) return wrap('t25-b3', renderWbwText(full, 'wbw-slide', 'imp-italic', active));
      return wrap('t25-b0', (
        <span className="hand-txt lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br />{renderTextWithHero(lines2[1], 'imp-rose')}</>}
        </span>
      ));
    case 't26':
      if (normalizedBlockIndex === 1) return wrap('t26-b1', <span className="fast-slide lekha-template-fit">{renderTextWithHero(upperFull, 'imp-rose')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t26-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t26-b3', renderWbwText(full, 'wbw-slide', 'imp-rose', active));
      return wrap('t26-b0', <span className="hard-txt lekha-template-fit">{upperFull}</span>);
    case 't27':
      if (normalizedBlockIndex === 1) return wrap('t27-b1', <span className="lekha-template-fit" style={{ fontFamily: "'Exo 2', sans-serif", fontWeight: 700, color: 'rgba(0,229,255,0.6)' }}>{full}</span>);
      if (normalizedBlockIndex === 2) return wrap('t27-b2', <span className="lekha-template-fit">{renderTextWithHero(full, 'imp-bold')}</span>);
      if (normalizedBlockIndex === 3) return wrap('t27-b3', renderWbwText(full, 'wbw-rise', 'imp-cyan', active));
      return wrap('t27-b0', <span className="center-expand-txt lekha-template-fit">{upperFull}</span>);
    case 't28':
      if (normalizedBlockIndex === 1) return wrap('t28-b1', <span className="slow-fade lekha-template-fit">{renderTextWithHero(full, 'imp-italic')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t28-b2', renderWbwText(full, 'wbw-rise', 'imp-italic', active));
      if (normalizedBlockIndex === 3) return wrap('t28-b3', renderWbwText(full, 'wbw-slide', 'imp-gold', active));
      return wrap('t28-b0', (
        <span className="grain-txt lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br />{renderTextWithHero(lines2[1], 'imp-gold')}</>}
        </span>
      ));
    case 't29':
      if (normalizedBlockIndex === 1) return wrap('t29-b1', <span className="hard-rise lekha-template-fit">{renderTextWithHero(full, 'imp-rose')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t29-b2', renderWbwText(full, 'wbw-rise', 'imp-rose', active));
      if (normalizedBlockIndex === 3) return wrap('t29-b3', renderWbwText(full, 'wbw-slide', 'imp-bold', active));
      return wrap('t29-b0', <span className="slam-txt lekha-template-fit">{upperFull}</span>);
    case 't30':
      if (normalizedBlockIndex > 0) return wrap(`t30-b${normalizedBlockIndex}`, <span className="lekha-template-fit">{normalizedBlockIndex === 3 ? renderTextWithHero(full, 'imp-italic') : full}</span>);
      return wrap('t30-b0', (
        <span className="breathe-txt lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br /><span className="imp-italic">{lines2[1]}</span></>}
        </span>
      ));
    case 't31':
      if (normalizedBlockIndex === 1) return wrap('t31-b1', <span style={{ perspective: '500px' }} className="lekha-template-fit"><span className="flip-line" style={{ fontFamily: "'Playfair Display', serif" }}>{renderTextWithHero(full, 'imp-gold')}</span></span>);
      if (normalizedBlockIndex === 2) return wrap('t31-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t31-b3', renderWbwText(full, 'wbw-rise', 'imp-gold', active));
      return wrap('t31-b0', <span className="stamp-text lekha-template-fit">{top || lines2[0] || full}</span>);
    case 't32':
      if (normalizedBlockIndex === 1) return wrap('t32-b1', <span style={{ perspective: '500px' }} className="lekha-template-fit"><span className="flip-line" style={{ fontFamily: "'Bodoni Moda', serif", fontStyle: 'italic' }}>{renderTextWithHero(full, 'imp-italic')}</span></span>);
      if (normalizedBlockIndex === 2) return wrap('t32-b2', <span className="lekha-template-fit">{full}</span>);
      if (normalizedBlockIndex === 3) return wrap('t32-b3', renderWbwText(full, 'wbw-rise', 'imp-purple', active));
      return wrap('t32-b0', (
        <span style={{ fontStyle: 'italic' }} className="lekha-template-fit">
          {lines2.map((line, index) => (
            <span key={`${line}-${index}`} className="ink-line">
              {index === lines2.length - 1 ? renderTextWithHero(line, 'imp-purple') : line}
            </span>
          ))}
        </span>
      ));
    case 't33':
      if (normalizedBlockIndex === 1) return wrap('t33-b1', renderWbwText(full, 'wbw-seq-fade', 'imp-cyan', active));
      if (normalizedBlockIndex === 2) return wrap('t33-b2', renderKaraokeText(full));
      if (normalizedBlockIndex === 3) return wrap('t33-b3', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 4) return wrap('t33-b4', <span style={{ perspective: '500px' }} className="lekha-template-fit"><span className="flip-line" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{renderTextWithHero(full, 'imp-cyan')}</span></span>);
      return wrap('t33-b0', <span className="doc-line lekha-template-fit">{renderTextWithHero(full, 'imp-bold')}</span>);
    case 't34':
      if (normalizedBlockIndex === 1) return wrap('t34-b1', <span className="pow-txt lekha-template-fit">{renderTextWithHero(full, 'imp-cyan')}</span>);
      if (normalizedBlockIndex === 2) return wrap('t34-b2', renderWbwText(full, 'wbw-rise', 'imp-bold', active));
      if (normalizedBlockIndex === 3) return wrap('t34-b3', renderWbwText(full, 'wbw-slide', 'imp-cyan', active));
      return wrap('t34-b0', <span className="speed-txt lekha-template-fit">{upperFull}</span>);
    case 't35':
      if (normalizedBlockIndex > 0) return wrap(`t35-b${normalizedBlockIndex}`, <span className="lekha-template-fit">{normalizedBlockIndex === 3 ? renderTextWithHero(full, 'imp-italic') : full}</span>);
      return wrap('t35-b0', <span className="secret-txt lekha-template-fit">{renderTextWithHero(full, 'imp-italic')}</span>);
    case 't36':
      return wrap(`t36-b${normalizedBlockIndex}`, renderKaraokeText(full));
    case 't37':
      if (normalizedBlockIndex === 1) return wrap('t37-b1', renderWbwText(full, 'wbw-rise', 'imp-green', active));
      if (normalizedBlockIndex === 2) return wrap('t37-b2', <span className="neon-expand lekha-template-fit">{upperFull}</span>);
      if (normalizedBlockIndex === 3) return wrap('t37-b3', renderWbwText(full, 'wbw-seq', 'imp-green', active));
      return wrap('t37-b0', <span className="neon-pulse lekha-template-fit">{upperFull}</span>);
    case 't38':
      if (normalizedBlockIndex === 1) return wrap('t38-b1', renderWbwText(full, 'wbw-slide', 'imp-italic', active));
      if (normalizedBlockIndex === 2) return wrap('t38-b2', renderWbwText(full, 'wbw-rise', 'imp-underline', active));
      if (normalizedBlockIndex === 3) return wrap('t38-b3', renderWbwText(full, 'wbw-seq-fade', 'imp-italic', active));
      return wrap('t38-b0', (
        <span className="lekha-template-fit">
          {lines2.map((line, index) => (
            <span key={`${line}-${index}`} className="flip-line">
              {index === lines2.length - 1 ? renderTextWithHero(line, 'imp-italic') : line}
            </span>
          ))}
        </span>
      ));
    case 't39':
      return wrap(`t39-b${normalizedBlockIndex}`, renderWbwText(full, 'wbw-seq-fade', normalizedBlockIndex % 2 ? 'imp-rose' : 'imp-gold', active));
    case 't40':
      if (normalizedBlockIndex === 2) return wrap('t40-b2', <span className="lekha-template-fit">{full}</span>);
      return wrap(`t40-b${normalizedBlockIndex}`, (
        <span className="lekha-template-fit">
          {lines2[0]}{lines2[1] && <><br />{renderTextWithHero(lines2[1], normalizedBlockIndex === 3 ? 'imp-gold' : 'imp-italic')}</>}
        </span>
      ));
    default:
      return null;
  }
}

function AppliedAdvancedTemplateCaption({ templateId, text, blockIndex = 0 }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 16);
    const cancel = typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : clearTimeout;

    let frameTwo;
    const frameOne = raf(() => {
      frameTwo = raf(() => setActive(true));
    });

    return () => {
      cancel(frameOne);
      if (frameTwo) cancel(frameTwo);
    };
  }, [templateId, text, blockIndex]);

  return renderOriginalTemplateCaption(templateId, text, active, blockIndex);
}

function getOriginalTemplateBlockType(templateId, blockIndex = 0) {
  const blockTypes = ORIGINAL_TEMPLATE_BLOCK_TYPES[templateId] || ['styled'];
  const normalizedBlockIndex = ((blockIndex % blockTypes.length) + blockTypes.length) % blockTypes.length;
  return blockTypes[normalizedBlockIndex] || 'styled';
}

// --- Effect CSS helper ---
function _hexRgba(hex, a) {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${a})`
  } catch { return hex }
}

function computeEffectCSS(cs) {
  const type = cs?.effect_type || 'none'
  if (type === 'none') return {}
  const color = cs?.effect_color || '#000000'
  const blur   = ((cs?.effect_blur   ?? 50) / 100) * 24  // 0-24px
  const offset = ((cs?.effect_offset ?? 50) / 100) * 16  // 0-16px
  const dir    = cs?.effect_direction ?? -45
  const transp = cs?.effect_transparency ?? 40
  const thick  = cs?.effect_thickness ?? 50
  const alpha  = (100 - transp) / 100
  const rad = (dir * Math.PI) / 180
  const ox = +(Math.cos(rad) * offset).toFixed(1)
  const oy = +(Math.sin(rad) * offset).toFixed(1)
  const rc = (a = alpha) => _hexRgba(color, a)
  switch (type) {
    case 'shadow':
      return { textShadow: `${ox}px ${oy}px ${blur}px ${rc()}` }
    case 'lift':
      return { textShadow: `0px ${(offset * 0.4).toFixed(1)}px ${(blur * 0.5).toFixed(1)}px ${rc()}, 0px ${offset}px ${blur}px ${rc(alpha * 0.4)}` }
    case 'hollow':
      return { WebkitTextStroke: `${(thick / 40).toFixed(1)}px ${color}`, color: 'transparent', WebkitTextFillColor: 'transparent' }
    case 'splice':
      return { textShadow: `${ox}px ${oy}px 0px ${rc()}` }
    case 'outline':
      return { WebkitTextStroke: `${(thick / 40).toFixed(1)}px ${color}` }
    case 'echo':
      return { textShadow: `${ox}px ${oy}px 0px ${rc()}, ${ox * 2}px ${oy * 2}px 0px ${rc(alpha * 0.55)}, ${ox * 3}px ${oy * 3}px 0px ${rc(alpha * 0.25)}` }
    case 'neon': {
      const nc = cs?.effect_color || cs?.text_color || '#39ff14'
      return { textShadow: `0 0 ${(blur * 0.5).toFixed(1)}px ${nc}, 0 0 ${blur}px ${nc}, 0 0 ${(blur * 2).toFixed(1)}px ${nc}` }
    }
    default: return {}
  }
}

// Per-word effect CSS (uses ws keys, not cs keys)
function computeWordEffectCSS(ws) {
  const type = ws?.effectType || 'none';
  if (type === 'none') return {};
  const color = ws?.effectColor || '#000000';
  const blur = ((ws?.effectBlur ?? 50) / 100) * 24;
  const offset = ((ws?.effectOffset ?? 50) / 100) * 16;
  const dir = ws?.effectDirection ?? -45;
  const transp = ws?.effectTransparency ?? 40;
  const thick = ws?.effectThickness ?? 50;
  const alpha = (100 - transp) / 100;
  const rad = (dir * Math.PI) / 180;
  const ox = +(Math.cos(rad) * offset).toFixed(1);
  const oy = +(Math.sin(rad) * offset).toFixed(1);
  const rc = (a = alpha) => _hexRgba(color, a);
  switch (type) {
    case 'shadow': return { textShadow: `${ox}px ${oy}px ${blur}px ${rc()}` };
    case 'lift': return { textShadow: `0px ${(offset*0.4).toFixed(1)}px ${(blur*0.5).toFixed(1)}px ${rc()}, 0px ${offset}px ${blur}px ${rc(alpha*0.4)}` };
    case 'hollow': return { WebkitTextStroke: `${(thick/40).toFixed(1)}px ${color}`, color: 'transparent', WebkitTextFillColor: 'transparent' };
    case 'splice': return { textShadow: `${ox}px ${oy}px 0px ${rc()}` };
    case 'outline': return { WebkitTextStroke: `${(thick/40).toFixed(1)}px ${color}` };
    case 'echo': return { textShadow: `${ox}px ${oy}px 0px ${rc()}, ${ox*2}px ${oy*2}px 0px ${rc(alpha*0.55)}, ${ox*3}px ${oy*3}px 0px ${rc(alpha*0.25)}` };
    case 'neon': return { textShadow: `0 0 ${(blur*0.5).toFixed(1)}px ${color}, 0 0 ${blur}px ${color}, 0 0 ${(blur*2).toFixed(1)}px ${color}` };
    default: return {};
  }
}
// Memoized video element — prevents React from touching the <video> DOM node during
// parent re-renders. Without this, re-renders from scrubbing/state changes cause the
// browser to re-composite the video layer, which can show a black frame on some systems.
const MemoizedVideo = React.memo(function MemoizedVideo({ videoRef, videoUrl, onTimeUpdate, onLoadedMetadata, setIsPlaying }) {
  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className="w-full h-full object-contain"
      playsInline
      preload="auto"
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback nopip"
      onContextMenu={(e) => e.preventDefault()}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={onLoadedMetadata}
      onEnded={() => setIsPlaying(false)}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
    />
  );
}, (prev, next) => {
  // Only re-render when the video source changes — nothing else should touch the DOM
  return prev.videoUrl === next.videoUrl;
});

export default function VideoPlayer({
  videoUrl,
  currentTime,
  setCurrentTime,
  seekSignal,
  isPlaying,
  setIsPlaying,
  captions,
  captionStyle,
  duration,
  setDuration,
  setCaptionStyle,
  setCaptionStyleRaw,
  setCaptions,
  setCaptionsRaw,
  addToHistory,
  selectedCaptionId,
  setSelectedCaptionId,
  wordPopup,
  setWordPopup,
  onVideoLoaded,
  isVideoFullscreen,
  setIsVideoFullscreen
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartXPos, setDragStartXPos] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Custom Element State
  const [draggedElementId, setDraggedElementId] = useState(null);
  const [resizedElementId, setResizedElementId] = useState(null);
  const [elementDragStart, setElementDragStart] = useState({ x: 0, y: 0, initialTop: 0, initialLeft: 0 });
  const [elementResizeStart, setElementResizeStart] = useState({ x: 0, y: 0, initialWidth: 0, initialFontSize: 0, minWidth: 150, direction: 'right' });

  // const [wordPopup, setWordPopup] = useState(null); // Lifted to Dashboard
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartFontSize, setResizeStartFontSize] = useState(18);
  const [captionWidth, setCaptionWidth] = useState(300);
  const [resizeDirection, setResizeDirection] = useState('right');

  // Word dragging state (for both captions and text elements)
  const [draggingWord, setDraggingWord] = useState(null); // { captionId, wordIndex, startX, startY, initialX, initialY, isElement }
  const [resizingWord, setResizingWord] = useState(null);

  const captionRef = useRef(null);
  const videoContainerRef = useRef(null);
  const currentDragCoordinates = useRef(null);
  const lastDragDropTime = useRef(0);
  const wordResizeActiveRef = useRef(false);
  const inputRef = useRef(null);
  // Blocks handleTimeUpdate from propagating to Dashboard while user is dragging
  const isScrubbingRef = useRef(false);

  // ── Alignment snap guides ───────────────────────────────────────────────
  // { hLines: [pct], vLines: [pct] } — percent values to draw guide lines
  const [snapGuides, setSnapGuides] = useState({ hLines: [], vLines: [] });
  const [cptWordGuides, setCptWordGuides] = useState([]);
  const selectionHandleClass = 'absolute z-50 h-3 w-3 rounded-full border border-[#b76cff] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.7)]';

  // ── Canvas zoom (Ctrl+Scroll) ───────────────────────────────────────────
  const [canvasScale, setCanvasScale] = useState(1);
  const [activeCanvasTool, setActiveCanvasTool] = useState(null);
  const [showCornerGuides, setShowCornerGuides] = useState(true);
  const [showLayoutGuides, setShowLayoutGuides] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const canvasPanStartRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const fitCanvasSizeRef = useRef({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const clearActiveSelection = useCallback(() => {
    if (setSelectedCaptionId) setSelectedCaptionId(null);
    if (setWordPopup) setWordPopup(null);
  }, [setSelectedCaptionId, setWordPopup]);

  const getWordRenderOffset = useCallback((wordStyle = {}) => {
    const width = canvasSize.width || videoContainerRef.current?.offsetWidth || 0;
    const height = canvasSize.height || videoContainerRef.current?.offsetHeight || 0;
    const baselineWidth = fitCanvasSizeRef.current.width || width;
    const baselineHeight = fitCanvasSizeRef.current.height || height;

    const offsetX = typeof wordStyle.x_pct === 'number' && width
      ? (wordStyle.x_pct / 100) * width
      : (typeof wordStyle.x === 'number' && baselineWidth && width)
        ? (wordStyle.x * width) / baselineWidth
      : (wordStyle.x || 0);

    const offsetY = typeof wordStyle.y_pct === 'number' && height
      ? (wordStyle.y_pct / 100) * height
      : (typeof wordStyle.y === 'number' && baselineHeight && height)
        ? (wordStyle.y * height) / baselineHeight
      : (wordStyle.y || 0);

    return {
      x: offsetX,
      y: offsetY,
      isPositioned: Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01,
    };
  }, [canvasSize.height, canvasSize.width]);

  const isWordDetached = useCallback((wordStyle = {}) => (
    typeof wordStyle.abs_x_pct === 'number'
    && typeof wordStyle.abs_y_pct === 'number'
    && (Math.abs(wordStyle.abs_x_pct) > 0.01 || Math.abs(wordStyle.abs_y_pct) > 0.01)
  ), []);

  React.useLayoutEffect(() => {
    const syncFitCanvasSize = () => {
      const el = videoContainerRef.current;
      if (!el) return;
      const nextSize = {
        width: el.offsetWidth || 0,
        height: el.offsetHeight || 0,
      };
      if (!nextSize.width || !nextSize.height) return;

      setCanvasSize(prev => (
        prev.width === nextSize.width && prev.height === nextSize.height
          ? prev
          : nextSize
      ));

      if (!isVideoFullscreen) {
        fitCanvasSizeRef.current = nextSize;
      }
    };

    syncFitCanvasSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncFitCanvasSize)
      : null;
    if (observer && videoContainerRef.current) {
      observer.observe(videoContainerRef.current);
    }
    window.addEventListener('resize', syncFitCanvasSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncFitCanvasSize);
    };
  }, [isVideoFullscreen, videoUrl]);

  const getPreviewRenderScale = useCallback(() => {
    if (!isVideoFullscreen) return 1;
    const currentWidth = canvasSize.width || videoContainerRef.current?.offsetWidth || 0;
    const baselineWidth = fitCanvasSizeRef.current.width || currentWidth;
    if (!currentWidth || !baselineWidth) return 1;
    return currentWidth / baselineWidth;
  }, [canvasSize.width, isVideoFullscreen]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const toggleVideoFullscreen = useCallback(() => {
    if (!setIsVideoFullscreen) return;
    setIsVideoFullscreen(v => !v);
  }, [setIsVideoFullscreen]);

  // ── F / Shift+F → toggle fullscreen ────────────────────────────────────
  useEffect(() => {
    if (!toggleVideoFullscreen) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement?.isContentEditable)) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleVideoFullscreen();
        return;
      }
      if (e.key === 'Escape' && isVideoFullscreen && setIsVideoFullscreen) {
        e.preventDefault();
        setIsVideoFullscreen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isVideoFullscreen, setIsVideoFullscreen, toggleVideoFullscreen]);

  // ── Ctrl+Scroll → zoom canvas ───────────────────────────────────────────
  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setCanvasScale(prev => {
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        return Math.min(2, Math.max(0.5, +(prev + delta).toFixed(2)));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!isCanvasPanning) return;

    const handleMouseMove = (e) => {
      const { x, y, originX, originY } = canvasPanStartRef.current;
      setCanvasOffset({
        x: originX + (e.clientX - x),
        y: originY + (e.clientY - y),
      });
    };

    const handleMouseUp = () => {
      setIsCanvasPanning(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isCanvasPanning]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Local scrub time: used during Slider drag so we don't call setCurrentTime(Dashboard)
  // on every tick (which triggers heavy re-renders). Only committed on release.
  const [localScrubTime, setLocalScrubTime] = useState(null);

  // Handle external seek signals (from CaptionEditor clicking a caption, etc.)
  // seekSignal is set by Dashboard.handleSeek → ensures video element moves too
  useEffect(() => {
    if (videoRef.current && seekSignal !== null && seekSignal !== undefined) {
      videoRef.current.currentTime = seekSignal;
    }
  }, [seekSignal]);

  // Stable refs for callbacks passed to MemoizedVideo — these MUST not change reference
  // between renders, otherwise React.memo comparison would need to track them.
  const onVideoLoadedRef = useRef(onVideoLoaded);
  onVideoLoadedRef.current = onVideoLoaded;

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && !isScrubbingRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (onVideoLoadedRef.current) {
        onVideoLoadedRef.current(videoRef.current);
      }
    }
  }, [setDuration]);

  const handleSeek = (value) => {
    if (videoRef.current) {
      // Handle both array (from Slider) and scalar (from buttons) values
      const targetTime = Array.isArray(value) ? value[0] : value;
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleVideoSurfaceToggle = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [setIsPlaying]);

  const handleVideoSurfaceClick = useCallback((e) => {
    if (draggingWord || Date.now() - lastDragDropTime.current < 250) {
      return;
    }

    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest('button, input, textarea, select, [role="button"], [contenteditable="true"], [data-word-key], .resize-handle, .text-resize-handle, [data-video-control]')) {
      return;
    }

    clearActiveSelection();
    handleVideoSurfaceToggle();
  }, [clearActiveSelection, draggingWord, handleVideoSurfaceToggle]);

  const handleCanvasToolClick = useCallback((tool, e) => {
    e.stopPropagation();

    if (tool === 'zoom-in') {
      setCanvasScale(prev => Math.min(2, +(prev + 0.1).toFixed(2)));
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'zoom-out') {
      setCanvasScale(prev => Math.max(0.5, +(prev - 0.1).toFixed(2)));
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'reset') {
      setCanvasScale(1);
      setCanvasOffset({ x: 0, y: 0 });
      setShowCornerGuides(true);
      setShowLayoutGuides(false);
      setActiveCanvasTool(null);
      return;
    }

    if (tool === 'guides') {
      const nextVisible = !(showCornerGuides || showLayoutGuides);
      setShowCornerGuides(nextVisible);
      setShowLayoutGuides(nextVisible);
      setActiveCanvasTool(nextVisible ? 'guides' : null);
      return;
    }

    setActiveCanvasTool(tool);
  }, [showCornerGuides, showLayoutGuides]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (activeCanvasTool !== 'move') return;
    if (e.button !== 0) return;
    if (e.target.closest('button, input, textarea, select, [role="button"]')) return;

    e.preventDefault();
    e.stopPropagation();
    canvasPanStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: canvasOffset.x,
      originY: canvasOffset.y,
    };
    setIsCanvasPanning(true);
  }, [activeCanvasTool, canvasOffset.x, canvasOffset.y]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getActiveCaptions = () => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      !cap.isTextElement &&
      typeof cap.start_time === 'number' &&
      typeof cap.end_time === 'number' &&
      currentTime >= cap.start_time &&
      currentTime <= cap.end_time
    );
  };

  const getActiveTextElements = () => {
    if (!captions || captions.length === 0) return [];
    return captions.filter(cap =>
      cap &&
      cap.isTextElement &&
      typeof cap.start_time === 'number' &&
      typeof cap.end_time === 'number' &&
      currentTime >= cap.start_time &&
      currentTime <= cap.end_time
    );
  };

  const getAnimationStyle = (animationType, speed = 1) => {
    // [keyframe-name, duration-ms, timing, fill]
    const defs = {
      // General
      'rise':        ['rise',        400,  'ease-out',              'both'],
      'pan':         ['pan',         500,  'ease-in-out',           'both'],
      'fade':        ['fade',        500,  'ease-in',               'both'],
      'pop':         ['pop',         300,  'ease-out',              'both'],
      'wipe':        ['wipe',        400,  'ease-out',              'both'],
      'blur':        ['blur',        500,  'ease-in-out',           'both'],
      'succession':  ['succession',  400,  'ease-out',              'both'],
      'breathe':     ['breathe',    1500,  'ease-in-out',           'infinite'],
      'baseline':    ['baseline',    400,  'ease-out',              'both'],
      'drift':       ['drift',       600,  'ease-in-out',           'both'],
      'tectonic':    ['tectonic',    500,  'ease-out',              'both'],
      'tumble':      ['tumble',      600,  'ease-in-out',           'both'],
      // Advanced – Basic
      'fadeInUp':    ['fadeInUp',    500,  'ease-out',              'both'],
      'fadeInDown':  ['fadeInDown',  500,  'ease-out',              'both'],
      'slideInRight':['slideInRight',500,  'ease-out',              'both'],
      'flipInX':     ['flipInX',     600,  'ease-out',              'both'],
      'flipInY':     ['flipInY',     600,  'ease-out',              'both'],
      'blurIn':      ['blurIn',      500,  'ease-out',              'both'],
      'zoomInFade':  ['zoomInFade',  500,  'ease-out',              'both'],
      'bounceInUp':  ['bounceInUp',  600,  'ease-out',              'both'],
      'skewLeft':    ['skewLeft',    400,  'ease-out',              'both'],
      // Advanced – Kinetic
      'missile':     ['missile',     500,  'cubic-bezier(0.22,1,0.36,1)', 'both'],
      'shockwave':   ['shockwave',   500,  'ease-out',              'both'],
      'typewriter':  ['typewriter',  600,  'steps(20,end)',          'both'],
      'slamDown':    ['slamDown',    500,  'cubic-bezier(0.22,1,0.36,1)', 'both'],
      'fireCharge':  ['fireCharge',  500,  'ease-out',              'both'],
      'stampede':    ['stampede',    500,  'cubic-bezier(0.22,1,0.36,1)', 'both'],
      'recoil':      ['recoil',      400,  'ease-out',              'both'],
      // Advanced – Cinematic
      'irisOpen':    ['irisOpen',    600,  'ease-out',              'both'],
      'parallaxRise':['parallaxRise',700,  'ease-out',              'both'],
      'goldenRatio': ['goldenRatio', 600,  'ease-out',              'both'],
      'curtainSplit':['curtainSplit',500,  'ease-out',              'both'],
      'prestige':    ['prestige',   1000,  'ease-out',              'both'],
      'fadeThroughBlack':['fadeThroughBlack',800,'ease-in-out',     'both'],
      'depthPull':   ['depthPull',   600,  'ease-out',              'both'],
      'slowBurn':    ['slowBurn',   1500,  'ease-in',               'both'],
      'diagonalWipe':['diagonalWipe',500,  'ease-out',              'both'],
      // Advanced – Playful
      'confettiPop': ['confettiPop', 500,  'ease-out',              'both'],
      'stickerSlap': ['stickerSlap', 400,  'cubic-bezier(0.34,1.56,0.64,1)', 'both'],
      'wobbleEntry': ['wobbleEntry', 600,  'ease-out',              'both'],
      'balloonFloat':['balloonFloat',600,  'ease-out',              'both'],
      'colorSplash': ['colorSplash', 500,  'ease-out',              'both'],
    };
    const def = defs[animationType];
    if (!def) return 'none';
    const [name, ms, timing, fill] = def;
    const s = Math.max(0.1, speed || 1);
    const duration = fill === 'infinite' ? `${ms}ms` : `${Math.round(ms / s)}ms`;
    return `${name} ${duration} ${timing} ${fill}`;
  };

  const previewRenderScale = getPreviewRenderScale();
  const displayBackgroundPadding = Math.max(1, Math.round((captionStyle?.background_padding || 6) * 0.58));
  const displayBackgroundWidthMultiplier = Math.max(0.94, captionStyle?.background_h_multiplier || 1);
  const displayCaptionPadY = Math.max(1, Math.round((captionStyle?.background_padding || 6) * 0.55));
  const displayCaptionPadX = 6;

  const getTextElementDisplayMetrics = (style = {}) => ({
    backgroundPadding: Math.max(1, Math.round(((style.padding ?? 6) || 6) * 0.58)),
    backgroundWidthMultiplier: Math.max(0.94, style.backgroundHMultiplier || 1.05),
    textPadY: Math.max(1, Math.round(((style.padding ?? 6) || 6) * 0.55)),
    textPadX: 6,
  });

  const getTextElementEffectCSS = (style = {}) => {
    const effectStyles = computeEffectCSS(style);
    return {
      textShadow: effectStyles.textShadow || (style.hasShadow && !style.textGradient ? `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 2}px ${style.shadowBlur || 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` : undefined),
      WebkitTextStroke: effectStyles.WebkitTextStroke || (style.hasStroke === true && !style.textGradient ? `${style.strokeWidth || 0.5}px ${style.strokeColor || '#000000'}` : '0px transparent'),
    };
  };

  // Word-level animations — keyframes include translate(-50%,-50%) centering so they
  // don't override the inner span's centering transform.
  const getWordAnimationStyle = (animationType, speed = 1) => {
    const safeSpeed = Math.max(0.25, Number(speed) || 1);
    const duration = (seconds) => `${+(seconds / safeSpeed).toFixed(2)}s`;
    const animations = {
      'rise': `word-rise ${duration(0.4)} ease-out both`,
      'pan': `word-pan ${duration(0.5)} ease-in-out both`,
      'fade': `fade ${duration(0.5)} ease-in both`,
      'pop': `word-pop ${duration(0.3)} ease-out both`,
      'wipe': `wipe ${duration(0.4)} ease-out both`,
      'blur': `blur ${duration(0.5)} ease-in-out both`,
      'succession': `word-succession ${duration(0.4)} ease-out both`,
      'breathe': `word-breathe ${duration(1.5)} ease-in-out infinite`,
      'baseline': `word-baseline ${duration(0.4)} ease-out both`,
      'drift': `word-drift ${duration(0.6)} ease-in-out both`,
      'tectonic': `word-tectonic ${duration(0.5)} ease-out both`,
      'tumble': `word-tumble ${duration(0.6)} ease-in-out both`
    };
    return animations[animationType] || 'none';
  };

  const renderWordTextContent = (word, wordStyle = {}, fallbackColor = 'inherit') => {
    const decoration = wordStyle.textDecoration || 'none';
    const hasGradient = Boolean(wordStyle.textGradient);
    const showUnderline = decoration === 'underline';
    const showLineThrough = decoration === 'line-through';
    const shouldWrapWord = Boolean(wordStyle.boxWidth);

    return (
      <span
        style={{
          position: 'relative',
          display: shouldWrapWord ? 'block' : 'inline-block',
          width: shouldWrapWord ? '100%' : undefined,
          maxWidth: '100%',
          whiteSpace: 'inherit',
          overflowWrap: 'inherit',
          wordBreak: 'inherit',
          transformOrigin: 'center center',
          ...(showLineThrough ? { textDecoration: 'line-through' } : { textDecoration: 'none' }),
          ...computeWordEffectCSS(wordStyle),
          ...(hasGradient ? {
            backgroundImage: wordStyle.textGradient,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          } : {
            color: wordStyle.color || fallbackColor,
          }),
        }}
      >
        {word}
        {showUnderline && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '0.06em',
              height: '0.08em',
              borderRadius: 999,
              background: hasGradient ? wordStyle.textGradient : (wordStyle.color || fallbackColor || 'currentColor'),
            }}
          />
        )}
      </span>
    );
  };

  const renderAnimatedDetachedWordContent = (
    word,
    wordStyle = {},
    fallbackColor = 'inherit',
    animation = 'none',
    extraClassName = '',
  ) => {
    const shouldWrapWord = Boolean(wordStyle.boxWidth);
    const wrapStyle = {
      whiteSpace: shouldWrapWord ? 'normal' : 'nowrap',
      overflowWrap: shouldWrapWord ? 'anywhere' : 'normal',
      wordBreak: shouldWrapWord ? 'break-all' : 'normal',
      textAlign: 'center',
    };

    return (
      <span
        className={extraClassName}
        style={{
          position: 'relative',
          display: 'inline-block',
          width: shouldWrapWord ? '100%' : 'auto',
          maxWidth: shouldWrapWord ? '100%' : 'none',
          ...wrapStyle,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            transformOrigin: 'center center',
            display: 'inline-block',
            width: shouldWrapWord ? '100%' : 'auto',
            maxWidth: shouldWrapWord ? '100%' : 'none',
            animation,
            pointerEvents: 'none',
            ...wrapStyle,
          }}
        >
          {renderWordTextContent(word, wordStyle, fallbackColor)}
        </span>
        <span
          aria-hidden="true"
          style={{
            visibility: 'hidden',
            display: 'inline-block',
            width: shouldWrapWord ? '100%' : 'auto',
            ...wrapStyle,
          }}
        >
          {word}
        </span>
      </span>
    );
  };

  const activeCaptions = getActiveCaptions();
  const activeTextElements = getActiveTextElements();

  const captionHasDetachedWords = (caption) => (
    Object.values(caption.wordStyles || {}).some(isWordDetached)
  );

  const isCaptionWordEditingActive = (caption) => (
    (draggingWord && draggingWord.captionId === caption.id)
    || (wordPopup?.caption?.id === caption.id)
  );

  const shouldRevealSequentially = (caption) => (
    !isCaptionWordEditingActive(caption)
    && isPlaying
    && (
    captionStyle?.show_inactive === false
    || (captionHasDetachedWords(caption) && !draggingWord)
    )
  );

  const isAdvancedTemplateCaptionEditingActive = (caption, blockIndex = 0) => {
    if (!isAdvancedTemplateId(captionStyle?.template_id)) return false;
    if ((draggingWord && draggingWord.captionId === caption.id) || wordPopup?.caption?.id === caption.id) return true;
    const wordStyles = caption.wordStyles || {};
    const blockType = getOriginalTemplateBlockType(captionStyle?.template_id, blockIndex);
    return Object.values(wordStyles).some((ws = {}) => (
      isWordDetached(ws)
      || Math.abs(ws.x_pct || 0) > 0.01
      || Math.abs(ws.y_pct || 0) > 0.01
      || (blockType === 'wbw-rise' && ws.animation === 'rise')
      || (blockType === 'wbw-slide' && ws.animation === 'slideLeft')
    ));
  };

  const getCaptionCurrentWordIndex = (caption, wordCount) => {
    const captionDuration = (caption.end_time || caption.end || 0) - (caption.start_time || caption.start || 0);
    const timeIntoCaption = (currentTime || 0) - (caption.start_time || caption.start || 0);
    return wordCount > 1 && captionDuration > 0
      ? Math.max(0, Math.min(wordCount - 1, Math.floor((timeIntoCaption / captionDuration) * wordCount)))
      : 0;
  };

  const renderEditableAdvancedTemplateCaption = (caption, blockIndex = 0) => {
    const words = caption.text.split(' ').filter(Boolean);
    const wordCount = words.length;
    const currentIdx = getCaptionCurrentWordIndex(caption, wordCount);
    const templateId = captionStyle?.template_id;
    const blockType = getOriginalTemplateBlockType(templateId, blockIndex);
    const blockClass = `${templateId}-b${blockIndex}`;
    const variantClass = blockType === 'wbw-slide' ? 'wbw-slide' : 'wbw-rise';

    return (
      <span className={`lekha-original-template ${templateId} ${templateId}-stage`}>
        <span
          className={`sblock ${templateId}-block ${blockClass} active lekha-applied-advanced-template`}
          data-template-block-index={blockIndex}
          data-template-block-type={blockType}
          style={{ opacity: 1, transition: 'opacity 280ms ease' }}
        >
          <span className={blockType === 'wbw-rise' || blockType === 'wbw-slide' ? `${variantClass} lekha-template-fit` : 'lekha-template-fit'}>
            {words.map((word, wordIndex, arr) => {
              if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null;

              const styleKey = `${caption.id}-${wordIndex}`;
              const ws = caption.wordStyles?.[styleKey] || {};
              const detached = isWordDetached(ws);
              const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
              const wordAnimation = ws.animation && ws.animation !== 'none'
                ? getWordAnimationStyle(ws.animation, ws.animationSpeed || 1)
                : 'none';
              const wordClassName = [
                blockType === 'wbw-rise' || blockType === 'wbw-slide' ? 'w in' : 'template-editable-word',
                ws.isEmphasis ? 'imp-bold' : '',
                isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
              ].filter(Boolean).join(' ');

              return (
                <React.Fragment key={`${styleKey}-editable`}>
                  {wordIndex > 0 && ' '}
                  <span
                    data-word-key={detached ? undefined : styleKey}
                    data-template-block-class={blockClass}
                    data-template-block-type={blockType}
                    data-template-word-class={wordClassName}
                    className={wordClassName}
                    style={{
                      display: 'inline-block',
                      visibility: detached ? 'hidden' : 'visible',
                      cursor: detached
                        ? 'default'
                        : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'grab'),
                      animation: wordAnimation,
                    }}
                    onPointerDown={detached ? undefined : (e) => handleWordMouseDown(e, caption, wordIndex, false, false, 'template')}
                    onClick={(e) => {
                      if (detached || Date.now() - lastDragDropTime.current < 150) return;
                      if (setWordPopup) {
                        e.stopPropagation();
                        setWordPopup({
                          word,
                          position: { x: e.clientX, y: e.clientY },
                          caption,
                          wordIndex,
                        });
                      }
                    }}
                    >
                      <span
                        data-word-drag-visual="true"
                        style={{ display: 'inline-block' }}
                      >
                        {renderWordTextContent(word, ws, 'inherit')}
                      </span>
                    {wordIndex < arr.length - 1 ? '\u00A0' : ''}
                  </span>
                </React.Fragment>
              );
            })}
          </span>
        </span>
      </span>
    );
  };

  const renderAppliedSidebarTemplateCaption = (caption) => {
    const words = String(caption.text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    const frameWidth = canvasSize.width || videoContainerRef.current?.offsetWidth || 240;
    const frameHeight = canvasSize.height || videoContainerRef.current?.offsetHeight || 426;
    const shellWidth = Math.max(
      160,
      Math.min(frameWidth * 0.94, SIDEBAR_TEMPLATE_APPLIED_WIDTH_CAP * previewRenderScale),
    );
    const shellHeight = Math.max(
      120,
      Math.min(frameHeight * 0.56, SIDEBAR_TEMPLATE_APPLIED_HEIGHT_CAP * previewRenderScale),
    );

    const templateDoc = buildAppliedSidebarTemplateDoc({
      captionText: caption.text || '',
      captionStyle,
      previewScale: previewRenderScale,
    })

    if (templateDoc) {
      return (
        <span
          key={`${caption.id}-${captionStyle?.template_20_id || 'sidebar-template'}-${caption.text}`}
          className="lekha-sidebar-applied-template-shell"
          data-template-id={captionStyle?.template_20_id || undefined}
          data-template-source={captionStyle?.template_source || undefined}
          style={{
            display: 'block',
            width: `${Math.round(shellWidth)}px`,
            height: `${Math.round(shellHeight)}px`,
            maxWidth: '94%',
            overflow: 'hidden',
            pointerEvents: 'none',
            transform: `scale(${captionStyle?.scale || 1})`,
            transformOrigin: 'center center',
            background: 'transparent',
          }}
        >
          <iframe
            title={`${captionStyle?.template_name || captionStyle?.template_20_id || 'Template'} applied caption`}
            srcDoc={templateDoc}
            scrolling="no"
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              overflow: 'hidden',
              background: 'transparent',
              pointerEvents: 'none',
            }}
          />
        </span>
      );
    }

    const isNewTemplateSet = captionStyle?.template_source === 'lekha-49';
    const templateClass = String(captionStyle?.template_class || captionStyle?.template_20_id || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const templateEffect = String(captionStyle?.template_effect || (isNewTemplateSet ? 'wrise' : 'wfade')).toLowerCase().replace(/[^a-z0-9-]/g, '');
    const baseColor = captionStyle?.text_color || '#FFFFFF';
    const baseFontSize = (captionStyle?.font_size || 22) * previewRenderScale;

    return (
      <span
        key={`${caption.id}-${captionStyle?.template_20_id || 'sidebar-template'}-${caption.text}`}
        className={isNewTemplateSet ? `lekha-sidebar-source-template lk-card ${templateClass}` : `lekha-sidebar-source-template card ${templateClass}`}
        data-template-id={captionStyle?.template_20_id || undefined}
        data-template-source={captionStyle?.template_source || undefined}
        style={{
          '--sidebar-source-accent': captionStyle?.secondary_color || captionStyle?.highlight_color || '#FFE600',
          '--sidebar-source-color': baseColor,
          '--sidebar-source-line-height': captionStyle?.line_spacing || 1.25,
          color: baseColor,
          fontFamily: captionStyle?.font_family || 'Raleway',
          fontSize: `${baseFontSize}px`,
          fontWeight: captionStyle?.font_weight || (isNewTemplateSet ? '400' : '300'),
          fontStyle: captionStyle?.font_style || 'normal',
          lineHeight: captionStyle?.line_spacing || 1.25,
          letterSpacing: captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : undefined,
          textAlign: 'center',
          textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
          opacity: captionStyle?.text_opacity ?? 1,
          transform: `scale(${captionStyle?.scale || 1})`,
          transformOrigin: 'center center',
        }}
      >
        <span className={isNewTemplateSet ? 'lk-stage' : 'stage'}>
          <span className={isNewTemplateSet ? 'sblock active' : 'sb active'}>
            <span className={isNewTemplateSet ? `wbw-line ${templateEffect}` : `wbw ${templateEffect}`}>
              {words.map((word, wordIndex, arr) => (
                <React.Fragment key={`${caption.id}-${wordIndex}-sidebar-fallback`}>
                  <span
                    className={isNewTemplateSet ? 'wbw-word normal visible' : 'w in'}
                    style={{
                      '--sidebar-source-word-delay': `${wordIndex * 58}ms`,
                    }}
                  >
                    {word}
                  </span>
                  {wordIndex < arr.length - 1 ? ' ' : ''}
                </React.Fragment>
              ))}
            </span>
          </span>
        </span>
      </span>
    );
  };

  const detachedCaptionWordOverlays = activeCaptions.flatMap((caption) => {
    const words = caption.text.split(' ');
    const wordCount = words.length;
    const currentIdx = getCaptionCurrentWordIndex(caption, wordCount);

    return words.map((word, wordIndex) => {
      if (shouldRevealSequentially(caption) && wordIndex > currentIdx) return null;

      const styleKey = `${caption.id}-${wordIndex}`;
      const ws = caption.wordStyles?.[styleKey] || {};
      if (!isWordDetached(ws)) return null;

      const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
      if (isSelected) return null;

      const rawWordFontSize = ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18);
      const wordFontSize = rawWordFontSize * previewRenderScale;
      const emphasisAccent = captionStyle?.secondary_color || '#FFD700';
      const wordAnimation = ws.animation && ws.animation !== 'none'
        ? getWordAnimationStyle(ws.animation, ws.animationSpeed || 1)
        : 'none';
      const { x: renderOffsetX, y: renderOffsetY } = getWordRenderOffset(ws);
      const emphasisStyle = ws.isEmphasis ? {
        fontWeight: 'bold',
        color: ws.color || emphasisAccent,
        fontSize: `${Math.round(wordFontSize * 1.2)}px`,
        textShadow: `0 0 18px ${emphasisAccent}99, 0 0 6px ${emphasisAccent}66`,
      } : {};
      const templateBlockClass = ws.templateBlockClass || '';
      const templateBlockType = ws.templateBlockType || '';
      const templateWordClass = ws.templateWordClass || '';
      const wordWrapStyle = ws.boxWidth ? {
        width: '100%',
        maxWidth: '100%',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-all',
        textAlign: 'center',
      } : {};
      const detachedWordContent = (
        <span style={{ display: ws.boxWidth ? 'block' : 'inline-block', ...wordWrapStyle, ...emphasisStyle }}>
          {renderAnimatedDetachedWordContent(
            word,
            ws,
            'inherit',
            wordAnimation,
            templateWordClass,
          )}
        </span>
      );

      return (
        <span
          key={`detached-${styleKey}`}
          data-word-key={styleKey}
          className={[
            captionStyle?.template_id ? `lekha-original-template ${captionStyle.template_id} ${captionStyle.template_id}-stage` : '',
            isSelected ? 'ring-2 ring-[#F5A623] rounded-sm' : '',
          ].filter(Boolean).join(' ')}
          style={{
            position: 'absolute',
            left: `${ws.abs_x_pct}%`,
            top: `${ws.abs_y_pct}%`,
            transform: `translate(-50%, -50%) translate(${renderOffsetX}px, ${renderOffsetY}px)${ws.rotation ? ` rotate(${ws.rotation}deg)` : ''}`,
            transformOrigin: 'center center',
            zIndex: 35,
            cursor: draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default',
            whiteSpace: ws.boxWidth ? 'normal' : 'nowrap',
            overflowWrap: ws.boxWidth ? 'anywhere' : 'normal',
            wordBreak: ws.boxWidth ? 'break-all' : 'normal',
            fontFamily: ws.fontFamily || captionStyle?.font_family || 'Inter',
            fontSize: `${wordFontSize}px`,
            fontWeight: ws.fontWeight || captionStyle?.font_weight || 'inherit',
            fontStyle: ws.fontStyle || captionStyle?.font_style || 'inherit',
            textDecoration: 'none',
            textTransform: ws.textTransform || undefined,
            ...(ws.boxWidth ? {
              width: `${ws.boxWidth * previewRenderScale}px`,
              textAlign: 'center',
            } : {}),
            ...(ws.backgroundColor || ws.highlightGradient ? {
              background: ws.highlightGradient || `rgba(${parseInt(ws.backgroundColor.slice(1,3),16)}, ${parseInt(ws.backgroundColor.slice(3,5),16)}, ${parseInt(ws.backgroundColor.slice(5,7),16)}, ${ws.backgroundOpacity ?? 0.6})`,
              borderRadius: '3px',
              padding: `${(ws.backgroundPadding || 2) * previewRenderScale}px ${4 * previewRenderScale}px`,
            } : {}),
            ...emphasisStyle,
          }}
          onPointerDown={(e) => handleWordMouseDown(e, caption, wordIndex, false, true)}
          onClick={(e) => {
            if (Date.now() - lastDragDropTime.current < 150) return;
            if (setWordPopup) {
              e.stopPropagation();
              setWordPopup({
                word,
                position: { x: e.clientX, y: e.clientY },
                caption,
                wordIndex,
              });
            }
          }}
        >
          {captionStyle?.template_id ? (
            <span
              className={`sblock ${captionStyle.template_id}-block ${templateBlockClass} active lekha-applied-advanced-template`}
              data-template-block-type={templateBlockType}
              style={{ opacity: 1, ...(ws.boxWidth ? { display: 'block', ...wordWrapStyle } : {}) }}
            >
              {detachedWordContent}
            </span>
          ) : detachedWordContent}
        </span>
      );
    }).filter(Boolean);
  });

  const selectedDetachedWord = (() => {
    if (!wordPopup?.caption || wordPopup?.type === 'element') return null;
    const liveCaption = captions?.find(c => c.id === wordPopup.caption.id) || activeCaptions.find(c => c.id === wordPopup.caption.id);
    if (!liveCaption) return null;

    const styleKey = `${liveCaption.id}-${wordPopup.wordIndex}`;
    const ws = liveCaption.wordStyles?.[styleKey] || {};
    if (!isWordDetached(ws)) return null;

    const words = (liveCaption.text || '').split(' ');
    const renderOffset = getWordRenderOffset(ws);
    return {
      caption: liveCaption,
      wordIndex: wordPopup.wordIndex,
      word: words[wordPopup.wordIndex] || wordPopup.word,
      fontSize: ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18),
      boxWidth: ws.boxWidth || null,
      textScaleX: ws.textScaleX || 1,
      x: ws.abs_x_pct,
      y: ws.abs_y_pct,
      renderOffset,
      rotation: ws.rotation || 0,
      wordStyle: ws,
    };
  })();

  const handleDetachedWordResizeStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    if (wordResizeActiveRef.current) return;

    const handle = e.currentTarget;
    const resizeAxis = handle.dataset.resizeAxis || 'corner';
    const selectionBox = handle.closest('[data-selected-word-box="true"]');
    const textNode = selectionBox?.querySelector('[data-selected-word-text="true"]');
    if (!selectionBox || !textNode) return;

    wordResizeActiveRef.current = true;
    if (addToHistory) addToHistory();

    const captionId = selectedDetachedWord.caption.id;
    const wordIndex = selectedDetachedWord.wordIndex;
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = selectionBox.getBoundingClientRect();
    const startTextRect = textNode.getBoundingClientRect();
    const videoRect = videoContainerRef.current?.getBoundingClientRect();
    const viewportScale = selectedDetachedWordViewport?.scale || 1;
    const renderScale = Math.max(previewRenderScale * viewportScale, 0.001);
    const initialFontSize = selectedDetachedWord.fontSize;
    const minTextboxWidth = 24;
    const initialBoxWidth = Math.max(minTextboxWidth, selectedDetachedWord.boxWidth || (startRect.width / renderScale) || Math.ceil(startTextRect.width / renderScale) || 80);
    const startCenterClientX = startRect.left + startRect.width / 2;
    const startCenterClientY = startRect.top + startRect.height / 2;
    const isLeftHandle = handle.dataset.resizeSide === 'left';
    const isTopHandle = handle.dataset.resizeSide === 'top';

    setResizingWord({
      captionId,
      wordIndex,
      startX,
      startY,
      initialFontSize,
      axis: resizeAxis,
    });
    document.body.style.cursor = resizeAxis === 'horizontal' ? 'ew-resize' : 'nwse-resize';
    document.body.style.userSelect = 'none';

    const writeWordStyle = (producer) => {
      const captionUpdater = setCaptionsRaw || setCaptions;
      captionUpdater(prev => prev.map(c => {
        if (c.id !== captionId) return c;
        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: producer(currentWordStyle),
          },
        };
      }));
    };

    const handleResizeMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (resizeAxis === 'horizontal') {
        const signedDeltaX = isLeftHandle ? -deltaX : deltaX;
        const nextBoxWidth = Math.max(minTextboxWidth, Math.min(520, Math.round(initialBoxWidth + signedDeltaX / renderScale)));
        const widthDeltaPx = (nextBoxWidth - initialBoxWidth) * renderScale;
        const nextCenterClientX = startCenterClientX + (isLeftHandle ? -widthDeltaPx / 2 : widthDeltaPx / 2);
        const nextAbsXPct = videoRect?.width
          ? Math.max(0, Math.min(100, ((nextCenterClientX - videoRect.left) / videoRect.width) * 100))
          : selectedDetachedWord.x;
        const nextAbsYPct = videoRect?.height
          ? Math.max(0, Math.min(100, ((startCenterClientY - videoRect.top) / videoRect.height) * 100))
          : selectedDetachedWord.y;
        selectionBox.style.width = `${nextBoxWidth * renderScale}px`;
        selectionBox.style.left = `${nextCenterClientX}px`;
        textNode.style.width = '100%';
        textNode.style.transform = '';
        selectionBox.style.overflow = 'visible';
        selectionBox.style.textAlign = 'center';
        selectionBox.style.whiteSpace = 'normal';
        selectionBox.style.overflowWrap = 'anywhere';
        selectionBox.style.wordBreak = 'break-all';

        writeWordStyle((currentWordStyle) => ({
          ...currentWordStyle,
          boxWidth: nextBoxWidth,
          textScaleX: 1,
          abs_x_pct: nextAbsXPct,
          abs_y_pct: nextAbsYPct,
        }));
        return;
      }

      const signedDeltaX = isLeftHandle ? -deltaX : deltaX;
      const signedDeltaY = isTopHandle ? -deltaY : deltaY;
      const dominantDelta = Math.abs(signedDeltaX) >= Math.abs(signedDeltaY) ? signedDeltaX : signedDeltaY;
      const startMeasure = Math.max(startTextRect.width, startTextRect.height, 1);
      const scale = Math.max(0.35, Math.min(5, (startMeasure + dominantDelta) / startMeasure));
      const nextFontSize = Math.max(8, Math.min(140, Math.round(initialFontSize * scale)));

      selectionBox.style.fontSize = `${nextFontSize * renderScale}px`;
      selectionBox.style.width = 'max-content';
      textNode.style.width = 'auto';
      textNode.style.transform = '';
      selectionBox.style.whiteSpace = 'nowrap';
      selectionBox.style.overflowWrap = 'normal';
      selectionBox.style.wordBreak = 'normal';

      writeWordStyle((currentWordStyle) => {
        const nextWordStyle = {
          ...currentWordStyle,
          fontSize: nextFontSize,
          frozenFontSize: nextFontSize,
        };
        delete nextWordStyle.boxWidth;
        delete nextWordStyle.textScaleX;
        return nextWordStyle;
      });
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      wordResizeActiveRef.current = false;
      setResizingWord(null);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleDetachedWordRotateStart = (e) => {
    if (!selectedDetachedWord || !setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();

    const captionId = selectedDetachedWord.caption.id;
    const wordIndex = selectedDetachedWord.wordIndex;
    const box = e.currentTarget.closest('[data-selected-word-box="true"]');
    const rect = box?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialRotation = selectedDetachedWord.rotation || 0;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    box.style.transformOrigin = 'center center';

    const handleRotateMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const nextRotation = Math.round(initialRotation + ((deltaX + deltaY) * 0.55));
      box.style.transform = `translate(-50%, -50%) rotate(${nextRotation}deg)`;
      box.style.transformOrigin = 'center center';

      setCaptions(prev => prev.map(c => {
        if (c.id !== captionId) return c;
        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};

        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              rotation: nextRotation,
            }
          }
        };
      }));
    };

    const handleRotateEnd = () => {
      document.removeEventListener('mousemove', handleRotateMove);
      document.removeEventListener('mouseup', handleRotateEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleRotateMove);
    document.addEventListener('mouseup', handleRotateEnd);
  };

  const handleSelectedDetachedWordDelete = useCallback(() => {
    if (!selectedDetachedWord || !setCaptions) return;
    if (addToHistory) addToHistory();

    const captionUpdater = setCaptionsRaw || setCaptions;
    captionUpdater(prev => prev.map(c => {
      if (c.id !== selectedDetachedWord.caption.id) return c;
      const wordStyles = c.wordStyles || {};
      const styleKey = `${c.id}-${selectedDetachedWord.wordIndex}`;
      const currentWordStyle = wordStyles[styleKey] || {};
      const nextWordStyle = { ...currentWordStyle };

      delete nextWordStyle.abs_x_pct;
      delete nextWordStyle.abs_y_pct;
      delete nextWordStyle.x;
      delete nextWordStyle.y;
      delete nextWordStyle.x_pct;
      delete nextWordStyle.y_pct;
      delete nextWordStyle.boxWidth;
      delete nextWordStyle.textScaleX;
      delete nextWordStyle.rotation;
      delete nextWordStyle.isLocked;

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: nextWordStyle
        }
      };
    }));
  }, [addToHistory, selectedDetachedWord, setCaptions, setCaptionsRaw]);

  // Helper for single caption logic (for double click edit which we might need to scope to a specific one)
  // We'll use selectedCaptionId if active, or just the first active one
  const primaryCaption = selectedCaptionId
    ? activeCaptions.find(c => c.id === selectedCaptionId) || activeCaptions[0]
    : activeCaptions[0];

  // Build word groups based on wordsPerLine mode and per-word timestamps
  const buildWordGroups = (caption) => {
    const words = (caption.text || '').split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const mode = captionStyle?.wordsPerLine || 'dynamic';
    const captionDuration = caption.end_time - caption.start_time;

    // --- Fixed modes ---
    let chunkSize = null;
    if (mode === '1-2') chunkSize = 2;
    else if (mode === '2-3') chunkSize = 3;
    else if (mode === '3-5') chunkSize = 5;

    if (chunkSize !== null) {
      const groups = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        groups.push({ start: i, end: Math.min(i + chunkSize - 1, words.length - 1) });
      }
      return groups;
    }

    // --- Dynamic mode: use per-word timestamps if available ---
    const hasWordTimestamps = caption.words && caption.words.length > 0;

    if (hasWordTimestamps) {
      // Group by natural speech pauses / density using millisecond timestamps
      const groups = [];
      let groupStart = 0;

      while (groupStart < words.length) {
        const remaining = words.length - groupStart;
        // Get timing info for words in this potential group
        const getWordDuration = (idx) => {
          const w = caption.words[idx];
          if (!w || typeof w.end !== 'number' || typeof w.start !== 'number') return 0.3;
          const dur = w.end - w.start;
          return isFinite(dur) && dur > 0 ? dur : 0.3;
        };
        const getGapAfter = (idx) => {
          const w = caption.words[idx];
          const next = caption.words[idx + 1];
          if (!w || !next) return 0;
          return next.start - w.end;
        };

        // Determine how many words to include in this group
        let groupSize = 1;
        const wps = words.length / captionDuration; // words per second for whole caption

        if (remaining === 1) {
          groupSize = 1;
        } else if (wps >= 4) {
          // Fast speech: group 3–5 words, but break on natural pauses
          let maxGroup = remaining <= 5 ? remaining : 3;
          groupSize = 1;
          for (let k = 1; k < maxGroup; k++) {
            const gap = getGapAfter(groupStart + k - 1);
            if (gap > 0.15) break; // pause detected – stop grouping
            groupSize = k + 1;
          }
        } else if (wps >= 2.5) {
          // Normal speech: 2–3 words, break on pause
          let maxGroup = Math.min(3, remaining);
          groupSize = 1;
          for (let k = 1; k < maxGroup; k++) {
            const gap = getGapAfter(groupStart + k - 1);
            if (gap > 0.2) break;
            groupSize = k + 1;
          }
        } else {
          // Slow / emphatic speech: 1 word at a time
          groupSize = 1;
        }

        groups.push({ start: groupStart, end: groupStart + groupSize - 1 });
        groupStart += groupSize;
      }
      return groups;
    }

    // --- Dynamic fallback (no word timestamps): speech-speed heuristic ---
    const wps = words.length / captionDuration;
    let wordsToShow = 1;
    if (wps >= 4.5) {
      wordsToShow = words.length <= 5 ? words.length : 3;
    } else if (wps >= 2.5) {
      wordsToShow = 2;
    } else {
      wordsToShow = 1;
    }

    const groups = [];
    for (let i = 0; i < words.length; i += wordsToShow) {
      groups.push({ start: i, end: Math.min(i + wordsToShow - 1, words.length - 1) });
    }
    return groups;
  };

  // Get highlighted word range for current time
  const getHighlightedWordRange = (caption) => {
    if (!caption) return { start: 0, end: 0 };
    const words = (caption.text || '').split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return { start: 0, end: 0 };

    const captionDuration = caption.end_time - caption.start_time;
    const timeInCaption = Math.max(0, currentTime - caption.start_time);
    const hasWordTimestamps = caption.words && caption.words.length > 0;

    if (hasWordTimestamps) {
      let activeIdx = 0;
      for (let i = 0; i < caption.words.length; i++) {
        if (currentTime >= caption.words[i].start) {
          activeIdx = i;
        } else {
          break;
        }
      }

      return { start: activeIdx, end: activeIdx };
    }

    // Fallback: time-based group detection
    const groups = buildWordGroups(caption);
    if (groups.length === 0) return { start: 0, end: 0 };
    const groupDuration = captionDuration / groups.length;
    const currentGroup = Math.min(Math.floor(timeInCaption / groupDuration), groups.length - 1);
    return groups[currentGroup];
  };

  const getHighlightedWordIndex = (caption) => {
    return getHighlightedWordRange(caption).start;
  };

  const handleCaptionDoubleClick = (e, caption) => {
    if (!setCaptions || !caption) return;
    e.stopPropagation();
    setIsEditing(caption.id);
    setEditText(caption.text || '');
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Place cursor at the end instead of selecting all
        const range = document.createRange();
        range.selectNodeContents(inputRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  };

  const handleEditComplete = (captionId) => {
    if (setCaptions && captionId) {
      setCaptions(prev => prev.map(cap =>
        cap.id === captionId ? { ...cap, text: editText } : cap
      ));
    }
    setIsEditing(false);
    setEditText('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText('');
    }
    // Allow all keys including backspace, Enter, etc.
  };

  const handleEditInput = (e) => {
    // Save cursor position before updating state
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(e.currentTarget);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const caretOffset = preCaretRange.toString().length;

    const newText = e.currentTarget.textContent;
    setEditText(newText);

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const newRange = document.createRange();
        const newSelection = window.getSelection();

        let charCount = 0;
        let node = inputRef.current.firstChild;

        if (node && node.nodeType === Node.TEXT_NODE) {
          const offset = Math.min(caretOffset, node.textContent.length);
          newRange.setStart(node, offset);
          newRange.setEnd(node, offset);
          newSelection.removeAllRanges();
          newSelection.addRange(newRange);
        }
      }
    });
  };

  // Handle individual word OR element word style updates
  const handleWordStyleChange = (key, value, skipHistory = false) => {
    if (!wordPopup || !setCaptions) return;

    const updater = skipHistory && setCaptionsRaw ? setCaptionsRaw : setCaptions;

    // Handle Text Element WORD Style Update (per-word styling)
    if (wordPopup.type === 'element') {
      updater(prev => prev.map(c => {
        if (c.id !== wordPopup.elementId) return c;

        const wordStyles = c.wordStyles || {};
        const styleKey = `${c.id}-${wordPopup.wordIndex}`;
        const currentWordStyle = wordStyles[styleKey] || {};
        const updatedWordStyle = { ...currentWordStyle, [key]: value };
        if (key === 'x') delete updatedWordStyle.x_pct;
        if (key === 'y') delete updatedWordStyle.y_pct;

        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: updatedWordStyle
          }
        };
      }));
      return;
    }

    // Handle Individual Word Style Update for regular captions
    const { caption, wordIndex } = wordPopup;
    if (!caption) return;

    updater(prev => prev.map(c => {
      if (c.id !== caption.id) return c;

      const wordStyles = c.wordStyles || {};
      const styleKey = `${c.id}-${wordIndex}`;
      const currentWordStyle = wordStyles[styleKey] || {};
      const updatedWordStyle = { ...currentWordStyle, [key]: value };
      if (key === 'x') delete updatedWordStyle.x_pct;
      if (key === 'y') delete updatedWordStyle.y_pct;

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: updatedWordStyle
        }
      };
    }));
  };

  const getPositionStyle = () => {
    const posY = captionStyle?.position_y ?? 75;
    const posX = captionStyle?.position_x ?? 50;
    const align = captionStyle?.text_align || 'center';

    // Anchor point shifts based on text alignment:
    // left   → left edge of caption at posX
    // center → center of caption at posX (default)
    // right  → right edge of caption at posX
    const transformX = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%';
    return {
      top: `${posY}%`,
      left: `${posX}%`,
      transform: `translate(${transformX}, -50%)`
    };
  };

  const handleMouseDown = (e) => {
    if (!setCaptionStyle || e.target.classList.contains('resize-handle')) return;
    // Don't trigger caption drag if we are dragging a word
    if (draggingWord) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartPos(captionStyle?.position_y !== undefined ? captionStyle.position_y : 50);
    setDragStartX(e.clientX);
    setDragStartXPos(captionStyle?.position_x !== undefined ? captionStyle.position_x : 50);
  };

  const handleTextElementMouseDown = (e, elementId, currentStyle) => {
    if (
      !setCaptions
      || e.target.classList.contains('text-resize-handle')
      || e.target.closest('button')
      || e.target.closest('[data-word-key]')
      || e.target.closest('[contenteditable="true"]')
    ) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setDraggedElementId(elementId);
    setElementDragStart({
      x: e.clientX,
      y: e.clientY,
      initialTop: currentStyle.top || 50,
      initialLeft: currentStyle.left || 50
    });
  };

  const handleTextElementResizeDown = (e, elementId, currentStyle) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    setResizedElementId(elementId);
    setElementResizeStart({
      x: e.clientX,
      y: e.clientY,
      initialWidth: currentStyle.width || 300,
      initialFontSize: currentStyle.fontSize || 18,
      minWidth: currentStyle.minWidth || 150,
      direction: e.currentTarget?.dataset?.resizeEdge || 'right',
    });
  };

  // ✅ ZERO-LATENCY NATIVE DRAG HANDLER
  // We use direct DOM manipulation for smooth 60fps tracking, bypassing React's render cycle.
  // State is only updated on mouseUp.
  function handleWordMouseDown(e, caption, wordIndex, isElement = false, isDetached = false, dragSource = 'direct') {
    if (!setCaptions) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const customStyle = caption?.wordStyles?.[`${caption?.id}-${wordIndex}`] || {};
    const renderedOffset = getWordRenderOffset(customStyle);
    
    // Use the element that received the event directly
    const targetElement = e.currentTarget;
    if (!targetElement) return;
    const dragPreviewElement = isDetached
      ? targetElement
      : targetElement.querySelector('[data-word-drag-visual="true"]') || targetElement;

    if (captionStyle?.template_id && !isElement && !isDetached) {
      const computedStyle = window.getComputedStyle(dragPreviewElement);
      const styleKey = `${caption.id}-${wordIndex}`;
      const captionUpdater = setCaptionsRaw || setCaptions;
      captionUpdater(prev => prev.map(c => {
        if (c.id !== caption.id) return c;
        const wordStyles = c.wordStyles || {};
        const currentWordStyle = wordStyles[styleKey] || {};
        return {
          ...c,
          wordStyles: {
            ...wordStyles,
            [styleKey]: {
              ...currentWordStyle,
              fontFamily: currentWordStyle.fontFamily || computedStyle.fontFamily,
              fontWeight: currentWordStyle.fontWeight || computedStyle.fontWeight,
              fontStyle: currentWordStyle.fontStyle || computedStyle.fontStyle,
              textTransform: currentWordStyle.textTransform || computedStyle.textTransform,
              color: currentWordStyle.color || computedStyle.color,
              templateBlockClass: targetElement.dataset.templateBlockClass || currentWordStyle.templateBlockClass,
              templateBlockType: targetElement.dataset.templateBlockType || currentWordStyle.templateBlockType,
              templateWordClass: targetElement.dataset.templateWordClass || currentWordStyle.templateWordClass,
            }
          }
        };
      }));
    }

    // Immediately create the dragging state
    const dragState = {
      captionId: caption.id,
      wordIndex,
      startX: e.clientX,
      startY: e.clientY,
      initialX: renderedOffset.x || 0,
      initialY: renderedOffset.y || 0,
      isElement,
      isDetached,
      dragSource,
      targetElement
    };
    
    setDraggingWord(dragState);
    currentDragCoordinates.current = { x: dragState.initialX, y: dragState.initialY };
    let hasMoved = false;
    let hasRecordedHistory = false;

    const videoContainer = videoContainerRef.current || videoRef.current?.parentElement;
    const containerWidth = videoContainer?.offsetWidth || canvasSize.width || 1;
    const containerHeight = videoContainer?.offsetHeight || canvasSize.height || 1;
    const baselineWidth = fitCanvasSizeRef.current.width || containerWidth;
    const baselineHeight = fitCanvasSizeRef.current.height || containerHeight;
    const containerRectAtStart = videoContainer?.getBoundingClientRect();
    const wordRectAtStart = dragPreviewElement.getBoundingClientRect();
    const startCenterXPct = containerRectAtStart?.width
      ? ((wordRectAtStart.left + wordRectAtStart.width / 2 - containerRectAtStart.left) / containerRectAtStart.width) * 100
      : 50;
    const startCenterYPct = containerRectAtStart?.height
      ? ((wordRectAtStart.top + wordRectAtStart.height / 2 - containerRectAtStart.top) / containerRectAtStart.height) * 100
      : 50;
    const snapTargetsX = [5, 25, 50, 75, 95];
    const snapTargetsY = [5, 25, 50, 75, 95];
    const snapThresholdPct = 2;
    const getWordSnap = (value, targets) => {
      const match = targets.find(target => Math.abs(value - target) <= snapThresholdPct);
      return typeof match === 'number' ? match : null;
    };
    const getLocalCptGuides = (deltaX, deltaY) => {
      if (!videoContainer || !containerRectAtStart || dragState.isElement) {
        return { deltaX, deltaY, guides: [] };
      }

      const styleKey = `${caption.id}-${wordIndex}`;
      const rawRect = {
        left: wordRectAtStart.left + deltaX,
        right: wordRectAtStart.right + deltaX,
        top: wordRectAtStart.top + deltaY,
        bottom: wordRectAtStart.bottom + deltaY,
        width: wordRectAtStart.width,
        height: wordRectAtStart.height,
      };
      rawRect.centerX = rawRect.left + rawRect.width / 2;
      rawRect.centerY = rawRect.top + rawRect.height / 2;

      const alignThreshold = 7;
      const sameColumnThreshold = 18;
      const visibleWordNodes = Array.from(videoContainer.querySelectorAll('[data-word-key]'))
        .filter(node => {
          if (!(node instanceof Element)) return false;
          if (node === targetElement || node === dragPreviewElement) return false;
          const key = node.getAttribute('data-word-key') || '';
          if (key === styleKey || !key.startsWith(`${caption.id}-`)) return false;
          const nodeStyle = window.getComputedStyle(node);
          if (nodeStyle.visibility === 'hidden' || nodeStyle.display === 'none' || nodeStyle.opacity === '0') return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 2 && rect.height > 2;
        })
        .map(node => ({ node, rect: node.getBoundingClientRect() }));

      let bestX = null;
      let bestY = null;
      for (const { rect } of visibleWordNodes) {
        const targetPoints = [
          { kind: 'center', value: rect.left + rect.width / 2 },
          { kind: 'left', value: rect.left },
          { kind: 'right', value: rect.right },
        ];
        const draggedPoints = [
          { kind: 'center', value: rawRect.centerX },
          { kind: 'left', value: rawRect.left },
          { kind: 'right', value: rawRect.right },
        ];

        for (const targetPoint of targetPoints) {
          for (const draggedPoint of draggedPoints) {
            if (targetPoint.kind !== draggedPoint.kind) continue;
            const distance = targetPoint.value - draggedPoint.value;
            if (Math.abs(distance) > alignThreshold) continue;
            if (!bestX || Math.abs(distance) < Math.abs(bestX.distance)) {
              bestX = { distance, targetRect: rect, x: targetPoint.value, kind: targetPoint.kind };
            }
          }
        }

        const targetYPoints = [
          { kind: 'middle', value: rect.top + rect.height / 2 },
          { kind: 'top', value: rect.top },
          { kind: 'bottom', value: rect.bottom },
        ];
        const draggedYPoints = [
          { kind: 'middle', value: rawRect.centerY },
          { kind: 'top', value: rawRect.top },
          { kind: 'bottom', value: rawRect.bottom },
        ];

        for (const targetPoint of targetYPoints) {
          for (const draggedPoint of draggedYPoints) {
            if (targetPoint.kind !== draggedPoint.kind) continue;
            const distance = targetPoint.value - draggedPoint.value;
            if (Math.abs(distance) > alignThreshold) continue;
            if (!bestY || Math.abs(distance) < Math.abs(bestY.distance)) {
              bestY = { distance, targetRect: rect, y: targetPoint.value, kind: targetPoint.kind };
            }
          }
        }
      }

      const snappedDeltaX = bestX ? deltaX + bestX.distance : deltaX;
      const snappedDeltaY = bestY ? deltaY + bestY.distance : deltaY;
      const snappedRect = {
        ...rawRect,
        left: rawRect.left + (bestX?.distance || 0),
        right: rawRect.right + (bestX?.distance || 0),
        centerX: rawRect.centerX + (bestX?.distance || 0),
        top: rawRect.top + (bestY?.distance || 0),
        bottom: rawRect.bottom + (bestY?.distance || 0),
        centerY: rawRect.centerY + (bestY?.distance || 0),
      };
      const guides = [];

      if (bestX) {
        const targetRect = bestX.targetRect;
        const gapTop = Math.min(targetRect.bottom, snappedRect.bottom);
        const gapBottom = Math.max(targetRect.top, snappedRect.top);
        const separatedY1 = snappedRect.centerY >= (targetRect.top + targetRect.height / 2)
          ? targetRect.bottom
          : snappedRect.bottom;
        const separatedY2 = snappedRect.centerY >= (targetRect.top + targetRect.height / 2)
          ? snappedRect.top
          : targetRect.top;
        const y1 = Math.abs(separatedY2 - separatedY1) > 2
          ? separatedY1
          : gapTop;
        const y2 = Math.abs(separatedY2 - separatedY1) > 2
          ? separatedY2
          : gapBottom;

        guides.push({
          type: 'vertical',
          x: bestX.x - containerRectAtStart.left,
          y1: Math.max(0, Math.min(y1, y2) - containerRectAtStart.top),
          y2: Math.min(containerRectAtStart.height, Math.max(y1, y2) - containerRectAtStart.top),
        });

      }

      if (bestY) {
        const targetRect = bestY.targetRect;
        const gapLeft = Math.min(targetRect.right, snappedRect.right);
        const gapRight = Math.max(targetRect.left, snappedRect.left);
        const separatedX1 = snappedRect.centerX >= (targetRect.left + targetRect.width / 2)
          ? targetRect.right
          : snappedRect.right;
        const separatedX2 = snappedRect.centerX >= (targetRect.left + targetRect.width / 2)
          ? snappedRect.left
          : targetRect.left;
        const x1 = Math.abs(separatedX2 - separatedX1) > 2
          ? separatedX1
          : gapLeft;
        const x2 = Math.abs(separatedX2 - separatedX1) > 2
          ? separatedX2
          : gapRight;

        guides.push({
          type: 'horizontal',
          y: bestY.y - containerRectAtStart.top,
          x1: Math.max(0, Math.min(x1, x2) - containerRectAtStart.left),
          x2: Math.min(containerRectAtStart.width, Math.max(x1, x2) - containerRectAtStart.left),
        });
      }

      const sameColumnTargets = visibleWordNodes
        .map(({ rect }) => ({
          rect,
          centerDistance: Math.abs((rect.left + rect.width / 2) - snappedRect.centerX),
        }))
        .filter(item => item.centerDistance <= sameColumnThreshold)
        .sort((a, b) => a.centerDistance - b.centerDistance);
      const nearestColumnTarget = sameColumnTargets[0]?.rect;
      if (nearestColumnTarget) {
        const gap = snappedRect.top >= nearestColumnTarget.bottom
          ? snappedRect.top - nearestColumnTarget.bottom
          : nearestColumnTarget.top - snappedRect.bottom;
        if (gap >= 3 && gap <= 36) {
          const markerX = Math.min(snappedRect.right, nearestColumnTarget.right) + 8;
          const y1 = snappedRect.top >= nearestColumnTarget.bottom ? nearestColumnTarget.bottom : snappedRect.bottom;
          const y2 = snappedRect.top >= nearestColumnTarget.bottom ? snappedRect.top : nearestColumnTarget.top;
          guides.push({
            type: 'spacing',
            x: Math.min(containerRectAtStart.width - 8, Math.max(8, markerX - containerRectAtStart.left)),
            y1: Math.max(0, y1 - containerRectAtStart.top),
            y2: Math.min(containerRectAtStart.height, y2 - containerRectAtStart.top),
          });
        }
      }

      return { deltaX: snappedDeltaX, deltaY: snappedDeltaY, guides };
    };

    const handleNativeMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - dragState.startX;
      const deltaY = moveEvent.clientY - dragState.startY;

      if (!hasMoved && Math.abs(deltaX) <= 3 && Math.abs(deltaY) <= 3) {
        return;
      }

      if (!hasMoved) {
        hasMoved = true;
        if (!hasRecordedHistory && addToHistory) {
          addToHistory();
          hasRecordedHistory = true;
        }
      }

      const rawCenterXPct = startCenterXPct + (deltaX / containerWidth) * 100;
      const rawCenterYPct = startCenterYPct + (deltaY / containerHeight) * 100;
      const snappedXPct = getWordSnap(rawCenterXPct, snapTargetsX);
      const snappedYPct = getWordSnap(rawCenterYPct, snapTargetsY);
      const baseDeltaX = deltaX + (typeof snappedXPct === 'number' ? ((snappedXPct - rawCenterXPct) / 100) * containerWidth : 0);
      const baseDeltaY = deltaY + (typeof snappedYPct === 'number' ? ((snappedYPct - rawCenterYPct) / 100) * containerHeight : 0);
      const localCptSnap = getLocalCptGuides(baseDeltaX, baseDeltaY);
      const adjustedDeltaX = localCptSnap.deltaX;
      const adjustedDeltaY = localCptSnap.deltaY;
      const newX = dragState.initialX + adjustedDeltaX;
      const newY = dragState.initialY + adjustedDeltaY;
      
      currentDragCoordinates.current = {
        x: newX,
        y: newY,
        deltaX: adjustedDeltaX,
        deltaY: adjustedDeltaY,
      };
      setSnapGuides({
        hLines: typeof snappedYPct === 'number' ? [snappedYPct] : [],
        vLines: typeof snappedXPct === 'number' ? [snappedXPct] : [],
      });
      setCptWordGuides(localCptSnap.guides);
      
      // Directly manipulate the DOM for zero-latency dragging
      if (dragState.isElement) {
        dragPreviewElement.style.setProperty(
          'transform',
          `translate(${newX}px, ${newY}px)`,
          'important'
        );
      } else if (dragState.isDetached) {
        dragPreviewElement.style.setProperty(
          'transform',
          `translate(-50%, -50%) translate(${adjustedDeltaX}px, ${adjustedDeltaY}px)${customStyle.rotation ? ` rotate(${customStyle.rotation}deg)` : ''}`,
          'important'
        );
      } else {
        dragPreviewElement.style.setProperty(
          'transform',
          `translate(-50%, -50%) translate(${adjustedDeltaX}px, ${adjustedDeltaY}px)`,
          'important'
        );
      }
    };

    const handleNativeMouseUp = () => {
      document.removeEventListener('mousemove', handleNativeMouseMove);
      document.removeEventListener('mouseup', handleNativeMouseUp);
      document.removeEventListener('pointermove', handleNativeMouseMove);
      document.removeEventListener('pointerup', handleNativeMouseUp);
      document.removeEventListener('pointercancel', handleNativeMouseUp);
      
      // Now perform the final React state update to save the new coordinates
      if (hasMoved) {
        const finalCoords = currentDragCoordinates.current;
        if (finalCoords) {
          const parentFontSize = isElement
            ? (caption.customStyle?.fontSize || 18)
            : (captionStyle?.font_size || 18);

          const containerRect = videoContainer?.getBoundingClientRect();
          const wordRect = dragPreviewElement.getBoundingClientRect();
          const absXPct = containerRect?.width
            ? ((wordRect.left + wordRect.width / 2 - containerRect.left) / containerRect.width) * 100
            : undefined;
          const absYPct = containerRect?.height
            ? ((wordRect.top + wordRect.height / 2 - containerRect.top) / containerRect.height) * 100
            : undefined;
          const detachedPositionDeltaPct = (
            typeof absXPct === 'number'
            && typeof absYPct === 'number'
          )
            ? Math.max(
                Math.abs(absXPct - startCenterXPct),
                Math.abs(absYPct - startCenterYPct)
              )
            : 0;
          const shouldDetachWord = !dragState.isElement && detachedPositionDeltaPct > 0.75;
            
          const captionUpdater = setCaptionsRaw || setCaptions;
          captionUpdater(prev => prev.map(c => {
            if (c.id !== dragState.captionId) return c;
            const wordStyles = c.wordStyles || {};
            const styleKey = `${c.id}-${dragState.wordIndex}`;
            const currentWordStyle = wordStyles[styleKey] || {};
            const nextWordStyle = dragState.isElement
              ? {
                  ...currentWordStyle,
                  x: (finalCoords.x / containerWidth) * baselineWidth,
                  y: (finalCoords.y / containerHeight) * baselineHeight,
                  x_pct: (finalCoords.x / containerWidth) * 100,
                  y_pct: (finalCoords.y / containerHeight) * 100,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                }
              : shouldDetachWord ? {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  abs_x_pct: typeof absXPct === 'number' ? absXPct : currentWordStyle.abs_x_pct,
                  abs_y_pct: typeof absYPct === 'number' ? absYPct : currentWordStyle.abs_y_pct,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                } : {
                  ...currentWordStyle,
                  x: 0,
                  y: 0,
                  x_pct: 0,
                  y_pct: 0,
                  frozenFontSize: currentWordStyle.frozenFontSize || parentFontSize
                };
            if (!dragState.isElement && !shouldDetachWord) {
              delete nextWordStyle.abs_x_pct;
              delete nextWordStyle.abs_y_pct;
            }
            
            return {
              ...c,
              wordStyles: {
                ...wordStyles,
                [styleKey]: nextWordStyle
              }
            };
          }));

          requestAnimationFrame(() => {
            if (dragState.isElement) {
              dragPreviewElement.style.setProperty(
                'transform',
                `translate(${finalCoords.x}px, ${finalCoords.y}px)`
              );
            } else {
              dragPreviewElement.style.setProperty(
                'transform',
                `translate(-50%, -50%)${customStyle.rotation ? ` rotate(${customStyle.rotation}deg)` : ''}`
              );
            }
          });
        }
        
        lastDragDropTime.current = Date.now();
      }
      
      setDraggingWord(null);
      currentDragCoordinates.current = null;
      setSnapGuides({ hLines: [], vLines: [] });
      setCptWordGuides([]);
    };

    document.addEventListener('mousemove', handleNativeMouseMove);
    document.addEventListener('mouseup', handleNativeMouseUp);
    document.addEventListener('pointermove', handleNativeMouseMove, { passive: false });
    document.addEventListener('pointerup', handleNativeMouseUp);
    document.addEventListener('pointercancel', handleNativeMouseUp);
  }

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (addToHistory) addToHistory();
    const captionBox = e.currentTarget?.parentElement;
    const measuredWidth = captionStyle?.boxWidth || captionBox?.getBoundingClientRect?.().width || captionWidth || 300;
    setIsResizing(true);
    setResizeStartX(e.clientX);
    setResizeStartY(e.clientY);
    setResizeStartWidth(measuredWidth);
    setResizeStartFontSize(captionStyle?.font_size || 18);
    setResizeDirection(e.currentTarget?.dataset?.resizeEdge || 'right');
  };

  // Global Mouse Move / Up for all dragging operations
  useEffect(() => {
    if ((!isDragging && !draggedElementId && !resizedElementId) || (!setCaptionStyle && !setCaptions)) return;

    const SNAP_THRESHOLD_PCT = 2.5; // % within which to snap
    const getSnapGuides = (axis, value, excludeId) => {
      // Static snap targets
      const targets = axis === 'y'
        ? [5, 50, 75, 95]
        : [5, 50, 95];
      // Add other elements
      if (captions) {
        captions.forEach(c => {
          if (c.isTextElement && c.id !== excludeId && c.customStyle) {
            if (axis === 'x' && c.customStyle.left != null) targets.push(c.customStyle.left);
            if (axis === 'y' && c.customStyle.top != null) targets.push(c.customStyle.top);
          }
        });
      }
      for (const t of targets) {
        if (Math.abs(value - t) <= SNAP_THRESHOLD_PCT) {
          return { snapped: true, value: t };
        }
      }
      return { snapped: false, value };
    };

    const handleMouseMove = (e) => {
      // 1. Handle Caption Full Drag (X and Y)
      if (isDragging) {
        const videoContainer = captionRef.current?.parentElement;
        if (!videoContainer) return;

        const containerHeight = videoContainer.offsetHeight;
        const containerWidth = videoContainer.offsetWidth;
        
        const deltaY = e.clientY - dragStartY;
        const deltaPercentY = (deltaY / containerHeight) * 100;
        let newPosY = dragStartPos + deltaPercentY;
        newPosY = Math.max(5, Math.min(95, newPosY));

        const deltaX = e.clientX - dragStartX;
        const deltaPercentX = (deltaX / containerWidth) * 100;
        let newPosX = dragStartXPos + deltaPercentX;
        newPosX = Math.max(5, Math.min(95, newPosX));

        // Snap check for Y and X axis
        const ySnap = getSnapGuides('y', newPosY, null);
        const xSnap = getSnapGuides('x', newPosX, null);
        
        let hLines = [];
        let vLines = [];
        
        if (ySnap.snapped) {
          newPosY = ySnap.value;
          hLines.push(newPosY);
        }
        if (xSnap.snapped) {
          newPosX = xSnap.value;
          vLines.push(newPosX);
        }
        
        setSnapGuides({ hLines, vLines });

        const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
        styleUpdater(prev => ({ 
          ...prev, 
          position_y: Math.round(newPosY),
          position_x: Math.round(newPosX)
        }));
      }

      // 3. Handle Text Element Drag
      if (draggedElementId && setCaptions) {
        const videoContainer = videoRef.current?.parentElement;
        if (!videoContainer) return;

        const containerWidth = videoContainer.offsetWidth;
        const containerHeight = videoContainer.offsetHeight;
        const deltaX = e.clientX - elementDragStart.x;
        const deltaY = e.clientY - elementDragStart.y;
        const deltaPercentX = (deltaX / containerWidth) * 100;
        const deltaPercentY = (deltaY / containerHeight) * 100;

        let newLeft = elementDragStart.initialLeft + deltaPercentX;
        let newTop = elementDragStart.initialTop + deltaPercentY;
        newLeft = Math.max(5, Math.min(95, newLeft));
        newTop = Math.max(5, Math.min(95, newTop));

        // Snap checks for X and Y
        const xSnap = getSnapGuides('x', newLeft, draggedElementId);
        const ySnap = getSnapGuides('y', newTop, draggedElementId);
        if (xSnap.snapped) newLeft = xSnap.value;
        if (ySnap.snapped) newTop = ySnap.value;
        setSnapGuides({
          hLines: ySnap.snapped ? [newTop] : [],
          vLines: xSnap.snapped ? [newLeft] : []
        });

        const captionUpdater = setCaptionsRaw || setCaptions;
        captionUpdater(prev => prev.map(c => {
          if (c.id !== draggedElementId) return c;
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              left: newLeft,
              top: newTop
            }
          };
        }));
      }

      // 4. Handle Text Element Resize
      if (resizedElementId && setCaptions) {
        const deltaX = e.clientX - elementResizeStart.x;
        const deltaY = e.clientY - elementResizeStart.y;
        const resizeDelta = (() => {
          switch (elementResizeStart.direction) {
            case 'left':
              return -deltaX;
            case 'top':
              return -deltaY;
            case 'bottom':
              return deltaY;
            case 'top-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY;
            case 'top-right':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
            case 'bottom-left':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY;
            case 'bottom-right':
            case 'corner':
              return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
            case 'right':
            default:
              return deltaX;
          }
        })();

        const isHorizontalFrameResize = ['left', 'right'].includes(elementResizeStart.direction);
        const minFrameWidth = isHorizontalFrameResize ? 28 : Math.min(elementResizeStart.minWidth || 150, 80);
        let newWidth = elementResizeStart.initialWidth + resizeDelta;
        newWidth = Math.max(minFrameWidth, Math.min(600, newWidth));

        const widthRatio = newWidth / Math.max(elementResizeStart.initialWidth, 1);
        let newFontSize = elementResizeStart.initialFontSize * widthRatio;
        newFontSize = Math.max(12, Math.min(60, newFontSize));

        const captionUpdater = setCaptionsRaw || setCaptions;
        captionUpdater(prev => prev.map(c => {
          if (c.id !== resizedElementId) return c;
          return {
            ...c,
            customStyle: {
              ...c.customStyle,
              width: newWidth,
              ...(isHorizontalFrameResize ? {} : { fontSize: newFontSize })
            }
          };
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggedElementId(null);
      setResizedElementId(null);
      setSnapGuides({ hLines: [], vLines: [] }); // clear guides
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove, { passive: false });
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [isDragging, dragStartY, dragStartPos, setCaptionStyle, setCaptions, draggedElementId, resizedElementId, elementDragStart, elementResizeStart]);

  useEffect(() => {
    if (!isResizing || !setCaptionStyle) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizeStartX;
      const deltaY = e.clientY - resizeStartY;
      const resizeDelta = (() => {
        switch (resizeDirection) {
          case 'left':
            return -deltaX;
          case 'top':
            return -deltaY;
          case 'bottom':
            return deltaY;
          case 'top-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : -deltaY;
          case 'top-right':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
          case 'bottom-left':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? -deltaX : deltaY;
          case 'bottom-right':
          case 'corner':
            return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
          case 'right':
          default:
            return deltaX;
        }
      })();

      const isHorizontalFrameResize = ['left', 'right'].includes(resizeDirection);
      const minFrameWidth = isHorizontalFrameResize ? 180 : 80;
      let newWidth = resizeStartWidth + resizeDelta;
      newWidth = Math.max(minFrameWidth, Math.min(600, newWidth));

      // Calculate proportional font size change
      const safeStartWidth = Math.max(resizeStartWidth, 1);
      const widthRatio = newWidth / safeStartWidth;
      let newFontSize = resizeStartFontSize * widthRatio;
      newFontSize = Math.max(12, Math.min(60, newFontSize));

      setCaptionWidth(newWidth);
      const styleUpdater = setCaptionStyleRaw || setCaptionStyle;
      styleUpdater(prev => ({
        ...prev,
        boxWidth: newWidth,
        ...(isHorizontalFrameResize ? {} : { font_size: newFontSize })
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove, { passive: false });
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [isResizing, resizeDirection, resizeStartFontSize, resizeStartWidth, resizeStartX, resizeStartY, setCaptionStyle]);

  const selectedDetachedWordViewport = (() => {
    if (!selectedDetachedWord || typeof window === 'undefined') return null;
    const videoFrame = videoContainerRef.current;
    const rect = videoFrame?.getBoundingClientRect();
    if (!rect) return null;
    const scaleX = rect.width && videoFrame.offsetWidth ? rect.width / videoFrame.offsetWidth : 1;
    const scaleY = rect.height && videoFrame.offsetHeight ? rect.height / videoFrame.offsetHeight : scaleX;

    return {
      x: rect.left + (rect.width * (selectedDetachedWord.x ?? 50)) / 100 + ((selectedDetachedWord.renderOffset?.x || 0) * scaleX),
      y: rect.top + (rect.height * (selectedDetachedWord.y ?? 50)) / 100 + ((selectedDetachedWord.renderOffset?.y || 0) * scaleY),
      scale: scaleX,
      scaleY,
    };
  })();

  const selectedDetachedWordEditor = selectedDetachedWord && selectedDetachedWordViewport && typeof document !== 'undefined'
    ? (() => {
      const isAdjustingSelectedWord = Boolean(
        resizingWord
        || (
          draggingWord
          && draggingWord.captionId === selectedDetachedWord.caption.id
          && draggingWord.wordIndex === selectedDetachedWord.wordIndex
        )
      );
      const isDraggingSelectedWord = Boolean(
        draggingWord
        && draggingWord.captionId === selectedDetachedWord.caption.id
        && draggingWord.wordIndex === selectedDetachedWord.wordIndex
      );
      const selectedWordStyle = selectedDetachedWord.wordStyle || {};
      const selectedWordBoxWidth = selectedDetachedWord.boxWidth || null;
      const selectedWordFontSize = selectedDetachedWord.fontSize * previewRenderScale * selectedDetachedWordViewport.scale;
      const selectedEmphasisAccent = captionStyle?.secondary_color || '#FFD700';
      const cptGuideFrameRect = videoContainerRef.current?.getBoundingClientRect();
      const selectedCenterXPct = cptGuideFrameRect?.width
        ? Math.max(0, Math.min(100, ((selectedDetachedWordViewport.x - cptGuideFrameRect.left) / cptGuideFrameRect.width) * 100))
        : 50;
      const selectedCenterYPct = cptGuideFrameRect?.height
        ? Math.max(0, Math.min(100, ((selectedDetachedWordViewport.y - cptGuideFrameRect.top) / cptGuideFrameRect.height) * 100))
        : 50;
      const shouldShowCptGuides = Boolean(cptGuideFrameRect && (isAdjustingSelectedWord || showLayoutGuides || activeCanvasTool === 'guides'));
      const shouldShowSelectedCrosshair = !(isDraggingSelectedWord || resizingWord);
      const selectedEmphasisStyle = selectedWordStyle.isEmphasis ? {
        fontWeight: 'bold',
        color: selectedWordStyle.color || selectedEmphasisAccent,
        fontSize: `${Math.round(selectedWordFontSize * 1.2)}px`,
        textShadow: `0 0 18px ${selectedEmphasisAccent}99, 0 0 6px ${selectedEmphasisAccent}66`,
      } : {};

      return createPortal(
      <>
      {shouldShowCptGuides && createPortal(
        <div
          data-cpt-text-guides="true"
          className="pointer-events-none fixed"
          style={{
            left: `${cptGuideFrameRect.left}px`,
            top: `${cptGuideFrameRect.top}px`,
            width: `${cptGuideFrameRect.width}px`,
            height: `${cptGuideFrameRect.height}px`,
            zIndex: 100004,
          }}
        >
          <div className="absolute inset-[6%] rounded-sm border border-[#dce85f]/45" />
          <div className="absolute top-0 bottom-0 w-px bg-[#dce85f]/55" style={{ left: '50%' }} />
          <div className="absolute left-0 right-0 h-px bg-[#dce85f]/35" style={{ top: '50%' }} />
          <div className="absolute top-0 bottom-0 border-l border-dashed border-white/45" style={{ left: '6%' }} />
          <div className="absolute top-0 bottom-0 border-l border-dashed border-white/45" style={{ left: '94%' }} />
          {shouldShowSelectedCrosshair && (
            <>
          <div className="absolute w-20 -translate-x-1/2 border-t border-dashed border-[#ff2f9f] shadow-[0_0_6px_rgba(255,47,159,0.45)]" style={{ left: `${selectedCenterXPct}%`, top: `${selectedCenterYPct}%` }} />
          <div className="absolute h-20 -translate-y-1/2 border-l border-dashed border-[#ff2f9f] shadow-[0_0_6px_rgba(255,47,159,0.45)]" style={{ left: `${selectedCenterXPct}%`, top: `${selectedCenterYPct}%` }} />
            </>
          )}
        </div>,
        document.body
      )}
      <span
        data-selected-word-box="true"
        data-word-key={`${selectedDetachedWord.caption.id}-${selectedDetachedWord.wordIndex}`}
        className="group fixed rounded-[1px] border border-[#9f83ff] bg-transparent px-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
        style={{
          left: `${selectedDetachedWordViewport.x}px`,
          top: `${selectedDetachedWordViewport.y}px`,
          zIndex: 100005,
          transform: `translate(-50%, -50%)${selectedDetachedWord.rotation ? ` rotate(${selectedDetachedWord.rotation}deg)` : ''}`,
          transformOrigin: 'center center',
          fontFamily: selectedWordStyle.fontFamily || captionStyle?.font_family || 'Inter',
          fontSize: `${selectedWordFontSize}px`,
          fontWeight: selectedWordStyle.fontWeight || captionStyle?.font_weight || 'inherit',
          fontStyle: selectedWordStyle.fontStyle || captionStyle?.font_style || 'inherit',
          textDecoration: 'none',
          textTransform: selectedWordStyle.textTransform || undefined,
          lineHeight: 1.1,
          color: selectedWordStyle.color || captionStyle?.text_color || '#ffffff',
          whiteSpace: selectedWordBoxWidth ? 'normal' : 'nowrap',
          overflowWrap: selectedWordBoxWidth ? 'anywhere' : 'normal',
          wordBreak: selectedWordBoxWidth ? 'break-all' : 'normal',
          overflow: 'visible',
          textAlign: 'center',
          display: 'block',
          boxSizing: 'border-box',
          width: selectedWordBoxWidth
            ? `${selectedWordBoxWidth * previewRenderScale * selectedDetachedWordViewport.scale}px`
            : 'auto',
          ...(selectedWordStyle.backgroundColor || selectedWordStyle.highlightGradient ? {
            background: selectedWordStyle.highlightGradient || `rgba(${parseInt(selectedWordStyle.backgroundColor.slice(1,3),16)}, ${parseInt(selectedWordStyle.backgroundColor.slice(3,5),16)}, ${parseInt(selectedWordStyle.backgroundColor.slice(5,7),16)}, ${selectedWordStyle.backgroundOpacity ?? 0.6})`,
            borderRadius: '3px',
            padding: `${(selectedWordStyle.backgroundPadding || 2) * previewRenderScale * selectedDetachedWordViewport.scale}px ${4 * previewRenderScale * selectedDetachedWordViewport.scale}px`,
          } : {}),
          ...selectedEmphasisStyle,
          cursor: resizingWord ? 'nwse-resize' : (isDraggingSelectedWord ? 'grabbing' : 'default'),
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.target.closest('.word-resize-handle')) return;
          handleWordMouseDown(e, selectedDetachedWord.caption, selectedDetachedWord.wordIndex, false, true);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        data-video-control
      >
        <button
          type="button"
          className="absolute -right-4 -top-4 z-[96] flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#141418] text-white/80 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.95)] transition-colors hover:border-red-400/60 hover:bg-red-500/12 hover:text-red-300"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelectedDetachedWordDelete();
          }}
          title="Delete word"
          data-video-control
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
        </button>
        <span
          data-selected-word-text="true"
          style={{
            display: 'inline-block',
            width: selectedWordBoxWidth ? '100%' : 'auto',
            minWidth: 0,
            whiteSpace: selectedWordBoxWidth ? 'normal' : 'nowrap',
            overflowWrap: selectedWordBoxWidth ? 'anywhere' : 'normal',
            wordBreak: selectedWordBoxWidth ? 'break-all' : 'normal',
            textAlign: 'center',
          }}
        >
          {renderWordTextContent(selectedDetachedWord.word, selectedWordStyle, captionStyle?.text_color || '#ffffff')}
        </span>
        {[
          { classes: '-top-4 -left-4 cursor-nwse-resize', axis: 'corner', sideX: 'left', sideY: 'top' },
          { classes: '-top-4 -right-4 cursor-nesw-resize', axis: 'corner', sideX: 'right', sideY: 'top' },
          { classes: '-bottom-4 -left-4 cursor-nesw-resize', axis: 'corner', sideX: 'left', sideY: 'bottom' },
          { classes: '-bottom-4 -right-4 cursor-nwse-resize', axis: 'corner', sideX: 'right', sideY: 'bottom' },
          { classes: 'top-1/2 -left-4 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'left' },
          { classes: 'top-1/2 -right-4 -translate-y-1/2 cursor-ew-resize', axis: 'horizontal', sideX: 'right' },
        ].map((handle) => (
          <span
            key={handle.classes}
            onPointerDown={handleDetachedWordResizeStart}
            onDragStart={(e) => e.preventDefault()}
            className={`word-resize-handle absolute z-[95] flex h-8 w-8 items-center justify-center rounded-full bg-transparent ${handle.classes}`}
            title="Resize word"
            data-resize-axis={handle.axis}
            data-resize-side={handle.sideX}
            data-resize-vertical-side={handle.sideY}
            data-video-control
          >
            <span className="block h-2 w-2 rounded-full border border-[#a78bfa] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]" />
          </span>
        ))}
        {!isAdjustingSelectedWord && (
          <span
            className="absolute left-1/2 top-full z-[95] mt-[14px] flex -translate-x-1/2 items-center gap-2"
            data-selected-word-actions="true"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
              style={{ cursor: 'grab' }}
              onPointerDown={handleDetachedWordRotateStart}
              title="Rotate word"
              data-video-control
            >
              <RotateCw className="h-3 w-3" strokeWidth={1.9} />
            </span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d8d2e8] bg-white text-[#4f4f5a] shadow-[0_2px_5px_rgba(15,15,20,0.16)] transition-transform hover:scale-105"
              style={{ cursor: 'move' }}
              onPointerDown={(e) => {
                const selectionBox = e.currentTarget.closest('[data-selected-word-box="true"]');
                if (!selectionBox) return;
                handleWordMouseDown({
                  preventDefault: () => e.preventDefault(),
                  stopPropagation: () => e.stopPropagation(),
                  clientX: e.clientX,
                  clientY: e.clientY,
                  currentTarget: selectionBox,
                }, selectedDetachedWord.caption, selectedDetachedWord.wordIndex, false, true, 'action-move');
              }}
              title="Move word"
              data-video-control
            >
              <Move className="h-3 w-3" strokeWidth={1.9} />
            </span>
          </span>
        )}
      </span>,
      </>,
      document.body
    );
    })()
    : null;

  return (
    <>
    <OriginalAdvancedTemplateStyles />
    <SidebarSourceTemplateStyles />
    <div className={`flex flex-col h-full ${isVideoFullscreen ? 'bg-black px-2 py-2' : ''}`}>
      {/* Video container with 9:16 aspect ratio for mobile preview */}
      <div className={`relative flex-1 rounded-xl overflow-visible flex items-center justify-center min-h-0 ${isVideoFullscreen ? 'pt-0 pb-2' : 'pt-4 pb-3'}`}>
        {/* Floating canvas tool rail beside the preview */}
        {setIsVideoFullscreen && (
          <div className={`absolute top-1/2 -translate-y-1/2 z-50 rounded-xl border border-white/10 bg-[#0d0d0d]/90 p-1.5 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md ${isVideoFullscreen ? 'left-[24%]' : 'left-2 sm:left-4'}`}>
            {[
              { icon: ZoomIn, title: 'Zoom in', key: 'zoom-in', active: false },
              { icon: ZoomOut, title: 'Zoom out', key: 'zoom-out', active: false },
              { icon: Grid2X2, title: 'Guides', key: 'guides', active: showCornerGuides || showLayoutGuides },
              { icon: RotateCcw, title: 'Reset view', key: 'reset', active: false },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.title}
                  type="button"
                  className={`mb-1 flex h-7 w-7 items-center justify-center rounded-lg transition-colors last:mb-0 ${
                    tool.active ? 'bg-white text-black' : 'text-slate-500 hover:bg-white/5 hover:text-white'
                  }`}
                  title={tool.title}
                  onClick={(e) => handleCanvasToolClick(tool.key, e)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleVideoFullscreen();
              }}
              className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              title={`${isVideoFullscreen ? 'Collapse' : 'Expand'} (F)`}
            >
              {isVideoFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        {/* Zoom level badge — only visible when zoomed */}
        {canvasScale !== 1 && (
          <div className="absolute top-2 left-2 z-50 px-1.5 py-0.5 rounded bg-black/60 text-white/70 text-[10px] tabular-nums backdrop-blur-sm">
            {Math.round(canvasScale * 100)}%
          </div>
        )}
        <div
          className={`relative inline-flex overflow-visible ${isVideoFullscreen ? 'scale-[1.02]' : ''}`}
          style={{ transition: 'transform 0.1s ease' }}
          onClick={(e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            if (target.closest('[data-caption-layer], [data-text-element-layer], [data-word-key], .resize-handle, .text-resize-handle, [data-video-control], button, input, textarea, select, [role="button"], [contenteditable="true"]')) {
              return;
            }
            clearActiveSelection();
          }}
        >
          {showCornerGuides && (
            <div className="pointer-events-none absolute -inset-[14px] z-[65]">
              <span className="absolute left-0 top-0 h-[18px] w-[18px] border-l border-t border-white/75" />
              <span className="absolute right-0 top-0 h-[18px] w-[18px] border-r border-t border-white/75" />
              <span className="absolute left-0 bottom-0 h-[18px] w-[18px] border-b border-l border-white/75" />
              <span className="absolute right-0 bottom-0 h-[18px] w-[18px] border-b border-r border-white/75" />
            </div>
          )}
        <div
          ref={videoContainerRef}
          className={`lekha-video-frame relative aspect-[9/16] touch-none select-none bg-black shadow-[0_35px_120px_rgba(0,0,0,0.72)] ${isVideoFullscreen ? 'h-auto max-h-[calc(100dvh-92px)]' : 'h-full max-h-[calc(100dvh-360px)] md:max-h-[calc(100dvh-296px)]'}`}
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
              transformOrigin: 'center center',
              transition: isCanvasPanning ? 'none' : 'transform 0.1s ease',
              cursor: activeCanvasTool === 'move' ? (isCanvasPanning ? 'grabbing' : 'grab') : 'default',
            }}
            onPointerDown={handleCanvasMouseDown}
            onClick={handleVideoSurfaceClick}
          >
          {showLayoutGuides && (
            <div className="pointer-events-none absolute inset-0 z-[80]">
              {[33.333, 66.666].map((pct) => (
                <div key={`layout-v-${pct}`} className="absolute top-0 bottom-0 w-px bg-white/14" style={{ left: `${pct}%` }} />
              ))}
              {[33.333, 66.666].map((pct) => (
                <div key={`layout-h-${pct}`} className="absolute left-0 right-0 h-px bg-white/14" style={{ top: `${pct}%` }} />
              ))}
            </div>
          )}
          {/* CPT snap guide lines */}
          {snapGuides.hLines.map((pct, i) => (
            <React.Fragment key={`hg-${i}`}>
              {Math.abs(pct - 50) < 0.01 && (
                <div
                  data-legacy-snap-guide="horizontal"
                  className="pointer-events-none absolute left-0 right-0 z-[998]"
                  style={{
                    top: `${pct}%`,
                    height: '1px',
                    background: 'rgba(255,60,60,0.85)',
                    boxShadow: '0 0 4px rgba(255,60,60,0.5)',
                  }}
                />
              )}
              {Math.abs(pct - 50) < 0.01 && (
                <div
                  data-cpt-snap-guide="horizontal"
                  className="pointer-events-none absolute left-0 right-0 z-[999] border-t border-dashed border-[#ff2f9f]"
                  style={{
                    top: `${pct}%`,
                    boxShadow: '0 0 6px rgba(255,47,159,0.5)',
                  }}
                />
              )}
            </React.Fragment>
          ))}
          {snapGuides.vLines.map((pct, i) => (
            <React.Fragment key={`vg-${i}`}>
              {Math.abs(pct - 50) < 0.01 && (
                <>
                  <div
                    data-legacy-snap-guide="vertical"
                    className="pointer-events-none absolute top-0 bottom-0 z-[998]"
                    style={{
                      left: `${pct}%`,
                      width: '1px',
                      background: 'rgba(60,120,255,0.85)',
                      boxShadow: '0 0 4px rgba(60,120,255,0.5)',
                    }}
                  />
                  <div
                    data-cpt-snap-guide="vertical"
                    className="pointer-events-none absolute top-0 bottom-0 z-[999] border-l border-[#ff2f9f]"
                    style={{
                      left: `${pct}%`,
                      boxShadow: '0 0 6px rgba(255,47,159,0.5)',
                    }}
                  />
                </>
              )}
            </React.Fragment>
          ))}
          {cptWordGuides.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-[1000]" data-cpt-word-guides="true">
              {cptWordGuides.map((guide, i) => {
                if (guide.type === 'vertical') {
                  const y1 = Math.max(0, Math.min(guide.y1, guide.y2));
                  const height = Math.max(8, Math.abs(guide.y2 - guide.y1));
                  return (
                    <div
                      key={`cpt-word-v-${i}`}
                      className="absolute border-l border-dashed border-[#66f2ff] shadow-[0_0_8px_rgba(102,242,255,0.65)]"
                      style={{
                        left: `${guide.x}px`,
                        top: `${y1}px`,
                        height: `${height}px`,
                      }}
                    />
                  );
                }

                if (guide.type === 'horizontal') {
                  const x1 = Math.max(0, Math.min(guide.x1, guide.x2));
                  const width = Math.max(8, Math.abs(guide.x2 - guide.x1));
                  return (
                    <div
                      key={`cpt-word-h-${i}`}
                      className="absolute border-t border-dashed border-[#66f2ff] shadow-[0_0_8px_rgba(102,242,255,0.65)]"
                      style={{
                        left: `${x1}px`,
                        top: `${guide.y}px`,
                        width: `${width}px`,
                      }}
                    />
                  );
                }

                if (guide.type === 'spacing') {
                  const y1 = Math.max(0, Math.min(guide.y1, guide.y2));
                  const height = Math.max(6, Math.abs(guide.y2 - guide.y1));
                  return (
                    <div
                      key={`cpt-word-spacing-${i}`}
                      className="absolute"
                      style={{
                        left: `${guide.x}px`,
                        top: `${y1}px`,
                        height: `${height}px`,
                      }}
                    >
                      <span className="absolute left-[-4px] top-0 h-px w-2 bg-[#f8e36a]" />
                      <span className="absolute left-[-4px] bottom-0 h-px w-2 bg-[#f8e36a]" />
                      <span className="absolute left-0 top-0 h-full border-l border-dashed border-[#f8e36a] shadow-[0_0_7px_rgba(248,227,106,0.55)]" />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
          {videoUrl ? (
            <>
              <MemoizedVideo
                videoRef={videoRef}
                videoUrl={videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                setIsPlaying={setIsPlaying}
              />
              <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
                <span className="rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1" /> Rec
                </span>
              </div>
              <div className="absolute top-3 right-3 z-40 rounded bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                9:16 - 24FPS
              </div>
              {!isPlaying && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(true);
                  }}
                  className="absolute left-1/2 top-1/2 z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/24 bg-transparent text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-transform hover:scale-[1.02]"
                  title="Play"
                >
                  <Play className="ml-0.5 h-5 w-5" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
              <p className="text-gray-500 text-sm text-center px-4">
                Upload a video to get started
              </p>
            </div>
          )}



          {/* Caption overlays */}
          {activeCaptions.map((caption) => {
            const isEditingThis = isEditing === caption.id;
            const hasDetachedWords = captionHasDetachedWords(caption);
            const isSidebarTemplate = hasSidebarTemplateStyle(captionStyle);
            const shouldWrapCaption = !isSidebarTemplate && !captionStyle?.template_id;
            const autoWrapMaxWidth = Math.max(
              220,
              Math.min(360, (canvasSize.width || videoContainerRef.current?.offsetWidth || 240) * 0.94)
            );
            const templateCaptionIndex = Math.max(0, captions.findIndex(c => c?.id === caption.id && !c?.isTextElement));
            // Text elements are positioned higher or custom, but for now we'll use same style
            // We should probably allow separate positioning for text elements in future, but keeping simple for now
            // or we use captionStyle but offset it if it's a text element? 
            // The current request implies basic overlap support. 
            // We use the same getPositionStyle() which uses global captionStyle. This is a limitation.
            // Ideally text elements should have their own position in their data.
            // Since we don't have per-caption position yet, they will stack.
            // Let's at least render them so they are visible.

            return (
              <div
                key={caption.id}
                ref={captionRef}
                data-caption-layer="true"
                className={isSidebarTemplate
                  ? 'absolute flex justify-center'
                  : `absolute px-3 flex justify-center ${setCaptionStyle && !isEditingThis && !hasDetachedWords ? 'cursor-move' : ''}`}
                style={isSidebarTemplate ? {
                  top: `${captionStyle?.position_y ?? 75}%`,
                  left: '50%',
                  width: '100%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: caption.isTextElement ? 20 : 10,
                  pointerEvents: setCaptionStyle ? 'auto' : 'none',
                } : {
                  ...getPositionStyle(),
                  // If it's a text element, maybe offset it slightly or allow it to be distinct?
                  // For now, they share the same position setting which allows dragging ONE changes ALL.
                  // This is "MVP" behavior.
                  zIndex: caption.isTextElement ? 20 : 10,
                  pointerEvents: setCaptionStyle ? 'auto' : 'none',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
                  if (setCaptionStyle && !isEditingThis && !hasDetachedWords && !isSidebarTemplate) {
                    handleMouseDown(e);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(caption.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleCaptionDoubleClick(e, caption);
                }}
              >
                <div
                  className={`border border-solid ${selectedCaptionId === caption.id && !hasDetachedWords && !isSidebarTemplate ? 'border-[#b76cff]' : 'border-transparent hover:border-[#b76cff]'} relative ${isSidebarTemplate ? '' : isDragging ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : setCaptionStyle && !hasDetachedWords ? 'cursor-grab' : ''} ${!hasDetachedWords && !isSidebarTemplate ? 'group' : ''} ${captionStyle?.template_id || ''} ${getTemplateContainerStateClass(captionStyle?.template_id)}`}
                  style={{
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: captionStyle?.text_align || 'center',
                    width: isSidebarTemplate ? '100%' : shouldWrapCaption ? 'max-content' : 'fit-content',
                    maxWidth: isSidebarTemplate
                      ? '100%'
                      : shouldWrapCaption
                        ? `${autoWrapMaxWidth}px`
                        : '90vw',
                    position: 'relative',
                    display: isSidebarTemplate ? 'flex' : 'inline-block',
                    justifyContent: isSidebarTemplate ? 'center' : undefined,
                    pointerEvents: isSidebarTemplate ? 'none' : 'auto',
                    '--template-primary': captionStyle?.text_color || '#ffffff',
                    '--template-secondary': captionStyle?.secondary_color || '#000000',
                    '--template-bg': captionStyle?.background_color || 'transparent',
                    '--template-highlight': captionStyle?.highlight_color || '#FFE600',
                  }}
                >
                  {/* Background layer — padding expands equally above and below the text */}
                  {false && captionStyle?.has_background && !hasDetachedWords && !isSidebarTemplate && (!captionStyle?.template_id || isSourceBasicTemplateId(captionStyle?.template_id)) && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${displayBackgroundPadding}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: `rgba(${parseInt((captionStyle?.background_color || '#000000').slice(1, 3), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(3, 5), 16)}, ${parseInt((captionStyle?.background_color || '#000000').slice(5, 7), 16)}, ${captionStyle?.background_opacity || 0.7})`,
                        borderRadius: '6px',
                        width: `${100 * displayBackgroundWidthMultiplier}%`,
                        height: `calc(100% + ${2 * displayBackgroundPadding}px)`,
                      }}
                    />
                  )}

                  {/* Resize handles for regular captions */}
                  {setCaptionStyle && !isEditingThis && !hasDetachedWords && !isSidebarTemplate && (
                    <>
                      {[
                        ['top-left', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
                        ['top', 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'],
                        ['top-right', 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize'],
                        ['left', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'],
                        ['right', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize'],
                        ['bottom-left', 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
                        ['bottom', 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'],
                        ['bottom-right', 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
                      ].map(([edge, positionClass]) => (
                        <div
                          key={edge}
                          className={`resize-handle ${selectionHandleClass} ${positionClass} transition-opacity ${selectedCaptionId === caption.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          data-resize-edge={edge}
                          onPointerDown={handleResizeMouseDown}
                          style={{ touchAction: 'none' }}
                        />
                      ))}
                    </>
                  )}

                  {isEditingThis ? (
                    <div
                      ref={inputRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleEditInput}
                      onBlur={() => handleEditComplete(caption.id)}
                      onKeyDown={handleEditKeyDown}
                      className="bg-transparent border-none outline-none text-center relative z-10"
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${(captionStyle?.font_size || 18) * previewRenderScale}px`,
                        lineHeight: captionStyle?.line_spacing || 1.4,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        letterSpacing: captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px',
                        wordSpacing: `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity || 1,
                        transform: `scale(${captionStyle?.scale || 1})`,
                        padding: hasDetachedWords ? '0px' : `${displayCaptionPadY}px ${displayCaptionPadX}px`,
                        whiteSpace: shouldWrapCaption ? 'normal' : 'nowrap',
                        wordBreak: 'normal',
                        ...(captionStyle?.text_gradient ? {
                          backgroundImage: captionStyle.text_gradient,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent',
                          display: 'block', // Editor needs block to have size
                        } : {
                          color: captionStyle?.text_color || '#ffffff'
                        }),
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        width: '100%',
                        minWidth: shouldWrapCaption ? '0px' : '200px',
                        minHeight: '60px'
                      }}
                    >
                      {editText}
                    </div>
                  ) : hasSidebarTemplateStyle(captionStyle) ? (
                    renderAppliedSidebarTemplateCaption(caption)
                  ) : captionStyle?.template_id ? (
                    // Template rendering: simple word spans with CSS class states for template effects
                    <span
                      key={`${caption.id}-${captionStyle?.template_id || 'template'}`}
                      className={getTemplateWrapperClassName(captionStyle?.template_id)}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: isAdvancedTemplateId(captionStyle?.template_id)
                          ? undefined
                          : `${scaleTemplateFontSize(captionStyle?.font_size) * previewRenderScale}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: 'block',
                        lineHeight: isAdvancedTemplateId(captionStyle?.template_id)
                          ? undefined
                          : `${scaleTemplateFontSize(captionStyle?.font_size) * previewRenderScale * (captionStyle?.line_spacing || 1.4)}px`,
                        letterSpacing: isAdvancedTemplateId(captionStyle?.template_id)
                          ? undefined
                          : (captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px'),
                        wordSpacing: isAdvancedTemplateId(captionStyle?.template_id)
                          ? undefined
                          : `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        whiteSpace: shouldWrapCaption ? 'normal' : 'nowrap',
                        wordBreak: 'normal',
                        padding: hasDetachedWords ? '0px' : undefined,
                        animation: caption.animation && caption.animation !== 'none' ? getAnimationStyle(caption.animation, caption.animationSpeed) : 'none',
                      }}
                    >
                      {(() => {
                        if (isAdvancedTemplateId(captionStyle?.template_id)) {
                          if (isAdvancedTemplateCaptionEditingActive(caption, templateCaptionIndex)) {
                            return renderEditableAdvancedTemplateCaption(caption, templateCaptionIndex);
                          }
                          return (
                            <AppliedAdvancedTemplateCaption
                              key={`${caption.id}-${captionStyle.template_id}-${templateCaptionIndex}-${caption.text}`}
                              templateId={captionStyle.template_id}
                              text={caption.text}
                              blockIndex={templateCaptionIndex}
                            />
                          );
                        }

                        const words = caption.text.split(' ');
                        const wordCount = words.length;
                        const isAdvancedTemplate = isAdvancedTemplateId(captionStyle?.template_id);
                        // Compute which word index is currently being spoken
                        const currentIdx = getCaptionCurrentWordIndex(caption, wordCount);

                        if (captionStyle?.template_id === 't-QW1') {
                          return (
                            <span className="sblock t-QW1">
                              <span className="sw-line v32-sw">
                                {words.map((word, wordIndex) => (
                                  <span
                                    key={wordIndex}
                                    className="sw-w"
                                    style={{ opacity: 1 }}
                                  >
                                    {word}
                                  </span>
                                ))}
                              </span>
                            </span>
                          );
                        }

                        const renderedWords = words.map((word, wordIndex, arr) => {
                          const isPast    = wordIndex < currentIdx;
                          const isCurrent = wordIndex === currentIdx;

                          const wordStyle = caption.wordStyles?.[`${caption.id}-${wordIndex}`] || {};
                          let cls = isSourceBasicTemplateId(captionStyle?.template_id)
                            ? getBasicTemplateWordClassName(captionStyle.template_id, isPast, isCurrent, wordStyle?.isEmphasis)
                            : 'word';
                          if (!isSourceBasicTemplateId(captionStyle?.template_id)) {
                            if (isCurrent) cls += ' current active';
                            else if (isPast) cls += ' active done';
                            if (wordStyle?.isEmphasis) cls += ' imp';
                          }
                          if (isAdvancedTemplate) {
                            const shouldShowAdvancedWord = captionStyle?.show_inactive !== false || !isPlaying || isPast || isCurrent;
                            cls = ['w', shouldShowAdvancedWord ? 'in' : '', wordStyle?.isEmphasis ? 'imp-bold' : '']
                              .filter(Boolean)
                              .join(' ');
                          }
                          const detached = isWordDetached(wordStyle);

                          // Word-by-word delivery mode: accumulate — show words 0..currentIdx
                          if (shouldRevealSequentially(caption) && wordIndex > currentIdx) {
                            return null;
                          }

                          const isSelected = wordPopup?.caption?.id === caption.id
                            && wordPopup?.wordIndex === wordIndex;

                          return (
                            <span
                              key={wordIndex}
                              data-word-key={detached ? undefined : `${caption.id}-${wordIndex}`}
                              className={cls + (isSelected ? ' ring-2 ring-[#F5A623] rounded-sm' : '')}
                              style={{
                                cursor: detached
                                  ? 'default'
                                  : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default'),
                                display: 'inline-block',
                                marginRight: wordIndex < words.length - 1 ? `${(captionStyle?.word_spacing ?? 1) * 2}px` : '0',
                                visibility: detached ? 'hidden' : 'visible',
                              }}
                              onClick={(e) => {
                                if (detached) return;
                                if (setWordPopup) {
                                  e.stopPropagation();
                                  setWordPopup({
                                    word,
                                    position: { x: e.clientX, y: e.clientY },
                                    caption,
                                    wordIndex,
                                  });
                                }
                              }}
                            >
                              {word}{wordIndex < arr.length - 1 ? ' ' : ''}
                            </span>
                          );
                        });

                        return isAdvancedTemplate ? (
                          <span className={getTemplateVariantClassName(captionStyle?.template_id)}>
                            {renderedWords}
                          </span>
                        ) : renderedWords;
                      })()}
                    </span>
                  ) : (
                    // Custom rendering: complex word-level inline styles with backgrounds and offsets
                    <span
                      className={`cap-text${caption.animation ? ` animate-${caption.animation}` : ''}`}
                      style={{
                        fontFamily: captionStyle?.font_family || 'Inter',
                        fontSize: `${(captionStyle?.font_size || 18) * previewRenderScale}px`,
                        lineHeight: `${(captionStyle?.font_size || 18) * previewRenderScale * (captionStyle?.line_spacing || 1.4)}px`,
                        fontWeight: captionStyle?.font_weight || 'normal',
                        fontStyle: captionStyle?.font_style || 'normal',
                        textAlign: captionStyle?.text_align || 'center',
                        display: 'block',
                        letterSpacing: captionStyle?.letter_spacing ? `${captionStyle.letter_spacing * previewRenderScale}px` : '0px',
                        wordSpacing: `${(captionStyle?.word_spacing ?? 0) * previewRenderScale}px`,
                        textDecoration: captionStyle?.text_decoration || 'none',
                        opacity: captionStyle?.text_opacity || 1,
                        transform: `scale(${captionStyle?.scale || 1})`,

                        animation: caption.animation && caption.animation !== 'none' ? getAnimationStyle(caption.animation, caption.animationSpeed) : 'none',
                        color: captionStyle?.text_color || '#ffffff',
                        textTransform: captionStyle?.text_case && captionStyle.text_case !== 'none' ? captionStyle.text_case : undefined,
                        padding: hasDetachedWords ? '0px' : `${displayCaptionPadY}px ${displayCaptionPadX}px`,
                        position: 'relative',
                        zIndex: 10,
                        whiteSpace: shouldWrapCaption ? 'normal' : 'nowrap',
                        wordBreak: 'normal',
                        // Add shadow/stroke if configured
                        ...(() => {
                          const efx = computeEffectCSS(captionStyle);
                          return {
                            textShadow: efx.textShadow || (captionStyle?.has_shadow && !captionStyle?.text_gradient ? `${captionStyle?.shadow_offset_x || 0}px ${captionStyle?.shadow_offset_y || 2}px ${captionStyle?.shadow_blur || 4}px ${captionStyle?.shadow_color || 'rgba(0,0,0,0.8)'}` : undefined),
                            WebkitTextStroke: efx.WebkitTextStroke || (captionStyle?.has_stroke === true && !captionStyle?.text_gradient ? `${captionStyle?.stroke_width || 0.5}px ${captionStyle?.stroke_color || '#000000'}` : '0px transparent'),
                          };
                        })(),
                        // Add background or highlight if configured
                        ...(!hasSidebarTemplateStyle(captionStyle) ? (
                          captionStyle?.highlight_gradient ? {
                            backgroundImage: captionStyle.highlight_gradient
                          } : captionStyle?.highlight_color ? {
                            backgroundColor: captionStyle.highlight_color
                          } : {}
                        ) : {}),
                        // Global text gradient
                        ...(captionStyle?.text_gradient ? {
                          backgroundImage: captionStyle.text_gradient,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent'
                        } : {})
                      }}
                    >
                      {(() => {
                        const sidebarTemplateActive = hasSidebarTemplateStyle(captionStyle);
                        const sidebarWords = caption.text.split(' ');
                        const sidebarCurrentIdx = getCaptionCurrentWordIndex(caption, sidebarWords.length);
                        const sidebarAccent = captionStyle?.secondary_color || '#FFE600';

                        return sidebarWords.map((word, wordIndex, arr) => {
                        // Word-by-word mode: compute current word index from timing
                        if (shouldRevealSequentially(caption)) {
                          const currentIdx = getCaptionCurrentWordIndex(caption, arr.length)
                          // Accumulate: show words 0..currentIdx (sentence builds word by word)
                          if (wordIndex > currentIdx) return null
                        }
                        const styleKey = `${caption.id}-${wordIndex}`;
                        const ws = caption.wordStyles?.[styleKey] || {};
                        const isSelected = wordPopup?.caption?.id === caption.id && wordPopup?.wordIndex === wordIndex;
                        const baseFontSize = (captionStyle?.font_size || 18) * previewRenderScale;
                        const rawWordFontSize = ws.fontSize || ws.frozenFontSize || (captionStyle?.font_size || 18);
                        const wordFontSize = rawWordFontSize * previewRenderScale;
                        const { x: renderOffsetX, y: renderOffsetY, isPositioned } = getWordRenderOffset(ws);
                        const detached = isWordDetached(ws);
                        const layoutFontSize = baseFontSize;
                        const isPastSidebarWord = sidebarTemplateActive && wordIndex < sidebarCurrentIdx;
                        const isCurrentSidebarWord = sidebarTemplateActive && wordIndex === sidebarCurrentIdx;
                        if (detached) {
                          return (
                            <span
                              key={wordIndex}
                              aria-hidden="true"
                              style={{
                                display: 'inline-block',
                                position: 'relative',
                                fontSize: `${layoutFontSize}px`,
                                lineHeight: 'inherit',
                                verticalAlign: 'baseline',
                                marginRight: wordIndex < arr.length - 1 ? `${Math.round(layoutFontSize * 0.18 + (captionStyle?.word_spacing ?? 1) * 2)}px` : '0',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  opacity: 0,
                                  pointerEvents: 'none',
                                  whiteSpace: 'nowrap',
                                  fontSize: `${wordFontSize}px`,
                                }}
                              >
                                {word}
                              </span>
                              <span style={{ visibility: 'hidden', fontSize: `${layoutFontSize}px`, whiteSpace: 'pre' }}>
                                {word}
                              </span>
                            </span>
                          );
                        }
                        // Keep line layout stable at the base caption size.
                        // Visual word styling happens in the absolutely-positioned inner span.

                        // Emphasis: bold + 1.2x scale + gold accent color + subtle glow
                        const emphasisAccent = captionStyle?.secondary_color || '#FFD700';
                        const emphasisStyle = ws.isEmphasis ? {
                          fontWeight: 'bold',
                          color: ws.color || emphasisAccent,
                          fontSize: `${Math.round(wordFontSize * 1.2)}px`,
                          textShadow: `0 0 18px ${emphasisAccent}99, 0 0 6px ${emphasisAccent}66`,
                        } : {};
                        const sidebarWordStyle = sidebarTemplateActive ? {
                          color: ws.color || (isCurrentSidebarWord ? sidebarAccent : (captionStyle?.text_color || '#ffffff')),
                          opacity: isCurrentSidebarWord ? 1 : (isPastSidebarWord ? 0.96 : 0.46),
                          textShadow: isCurrentSidebarWord ? `0 0 18px ${sidebarAccent}33` : undefined,
                        } : {};


                        const wordNode = (
                          <span
                            key={wordIndex}
                            data-word-key={`${caption.id}-${wordIndex}`}
                            style={{
                              display: 'inline-block',
                              position: 'relative',
                              fontSize: `${layoutFontSize}px`,
                              lineHeight: 'inherit',
                              verticalAlign: 'baseline',
                              marginRight: wordIndex < arr.length - 1 ? `${Math.round(layoutFontSize * 0.18 + (captionStyle?.word_spacing ?? 1) * 2)}px` : '0',
                              transform: !detached && isPositioned
                                ? `translate(${renderOffsetX}px, ${renderOffsetY}px)`
                                : 'none',
                              zIndex: !detached && isPositioned ? 20 : 'auto',
                              cursor: detached
                                ? 'default'
                                : (draggingWord?.captionId === caption.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default'),
                            }}
                            onPointerDown={detached ? undefined : (e) => handleWordMouseDown(e, caption, wordIndex)}
                            onClick={(e) => {
                              if (Date.now() - lastDragDropTime.current < 150) return;
                              if (setWordPopup) {
                                e.stopPropagation();
                                setWordPopup({
                                  word: word,
                                  position: { x: e.clientX, y: e.clientY },
                                  caption: caption,
                                  wordIndex: wordIndex
                                });
                              }
                            }}
                          >
                            {/* Fixed-size selection ring — sized by spacer, never by fontSize */}
                            {isSelected && (
                              <span style={{
                                position: 'absolute',
                                inset: '-2px',
                                border: '2px solid #F5A623',
                                borderRadius: '3px',
                                pointerEvents: 'none',
                                zIndex: 30,
                              }} />
                            )}
                            {/* Inner span: all visual styles. Absolute so it never affects layout flow */}
                            <span
                              data-word-drag-visual="true"
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: isCurrentSidebarWord ? 'translate(-50%, -50%) scale(1.03)' : 'translate(-50%, -50%)',
                                whiteSpace: 'nowrap',
                                fontFamily: ws.fontFamily || 'inherit',
                                fontSize: `${wordFontSize}px`,
                                fontWeight: ws.fontWeight || (isCurrentSidebarWord ? (captionStyle?.font_weight || '700') : 'inherit'),
                                fontStyle: ws.fontStyle || 'inherit',
                                textDecoration: ws.textDecoration || 'inherit',
                                textTransform: ws.textTransform || undefined,
                                ...(ws.textGradient ? {
                                  backgroundImage: ws.textGradient,
                                  WebkitBackgroundClip: 'text',
                                  backgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  color: 'transparent',
                                } : {
                                  color: ws.color || sidebarWordStyle.color || 'inherit',
                                }),
                                ...(sidebarTemplateActive ? sidebarWordStyle : {}),
                                ...(ws.backgroundColor ? {
                                  backgroundColor: `rgba(${parseInt(ws.backgroundColor.slice(1,3),16)}, ${parseInt(ws.backgroundColor.slice(3,5),16)}, ${parseInt(ws.backgroundColor.slice(5,7),16)}, ${ws.backgroundOpacity ?? 0.6})`,
                                  borderRadius: '3px',
                                  padding: `${(ws.backgroundPadding || 2) * previewRenderScale}px ${4 * previewRenderScale}px`,
                                } : {}),
                                ...computeWordEffectCSS(ws),
                                ...emphasisStyle,
                                animation: ws.animation && ws.animation !== 'none'
                                  ? getWordAnimationStyle(ws.animation)
                                  : 'none',
                              }}
                            >
                              {word}
                            </span>
                            {/* Invisible spacer — holds layout width at layoutFontSize (baseFontSize for dragged words) */}
                            <span style={{ visibility: 'hidden', fontSize: `${layoutFontSize}px`, whiteSpace: 'pre' }}>
                              {word}
                            </span>
                          </span>
                        );

                        return wordNode;
                      });
                      })()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {detachedCaptionWordOverlays}

          {/* Text Elements (render above captions) */}
          {activeTextElements.map((element) => {
            const style = element.customStyle || {};
            const isEditingThis = isEditing === element.id;
            const textElementMetrics = getTextElementDisplayMetrics(style);
            const textElementEffects = getTextElementEffectCSS(style);

            const handleDeleteElement = (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (setCaptions) {
                setCaptions(prev => prev.filter(c => c.id !== element.id));
              }
            };

            return (
              <div
                key={element.id}
                data-text-element-layer="true"
                className={`absolute group ${draggedElementId === element.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  top: `${style.top || 50}%`,
                  left: `${style.left || 50}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${style.width || 300}px`,
                  zIndex: style.zIndex || 50
                }}
                onPointerDown={(e) => {
                  if (!isEditingThis) {
                    // Set this text element as selected
                    if (setSelectedCaptionId) setSelectedCaptionId(element.id);
                    handleTextElementMouseDown(e, element.id, style);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (setSelectedCaptionId) setSelectedCaptionId(element.id);
                }}
                onDoubleClick={(e) => handleCaptionDoubleClick(e, element)}
              >
                <div
                  className={`border border-solid ${selectedCaptionId === element.id ? 'border-[#b76cff]' : 'border-transparent hover:border-[#b76cff]'} relative ${draggedElementId === element.id ? 'cursor-grabbing' : isEditingThis ? 'cursor-text' : 'cursor-grab'}`}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    padding: '0px',
                    textAlign: style.textAlign || 'center',
                    maxWidth: '90vw',
                    position: 'relative',
                    display: 'inline-block',
                  }}
                >
                  {style.hasBackground !== false && element.type !== 'textbox' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `-${textElementMetrics.backgroundPadding}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: -1,
                        backgroundColor: style.backgroundColor
                          ? `rgba(${parseInt(style.backgroundColor.slice(1, 3), 16)}, ${parseInt(style.backgroundColor.slice(3, 5), 16)}, ${parseInt(style.backgroundColor.slice(5, 7), 16)}, ${style.backgroundOpacity ?? 0.7})`
                          : `rgba(0, 0, 0, ${style.backgroundOpacity ?? 0.7})`,
                        borderRadius: `${style.borderRadius || 6}px`,
                        width: `${100 * textElementMetrics.backgroundWidthMultiplier}%`,
                        height: `calc(100% + ${2 * textElementMetrics.backgroundPadding}px)`,
                      }}
                    />
                  )}

                {/* Delete button - always visible on hover */}
                {!isEditingThis && (
                  <button
                    className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-zinc-900 border border-white/20 hover:border-red-500/50 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-50 flex items-center justify-center shadow-xl text-gray-400 hover:text-red-500"
                    onClick={handleDeleteElement}
                    title="Delete text element"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Resize handles - show for all active text elements */}
                {!isEditingThis && (
                  <>
                    {[
                      ['top-left', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
                      ['top', 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'],
                      ['top-right', 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize'],
                      ['left', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'],
                      ['right', 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize'],
                      ['bottom-left', 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
                      ['bottom', 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'],
                      ['bottom-right', 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
                    ].map(([edge, positionClass]) => (
                      <div
                        key={edge}
                        className={`text-resize-handle ${selectionHandleClass} ${positionClass} transition-opacity ${selectedCaptionId === element.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        data-resize-edge={edge}
                        onPointerDown={(e) => handleTextElementResizeDown(e, element.id, style)}
                        style={{ touchAction: 'none' }}
                      />
                    ))}
                  </>
                )}

                {isEditingThis ? (
                  <div
                    ref={inputRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditInput}
                    onBlur={() => handleEditComplete(element.id)}
                    onKeyDown={handleEditKeyDown}
                    className="bg-transparent border-none outline-none text-center relative z-10"
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      textTransform: style.textTransform || 'none',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      minHeight: '40px',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                        display: 'block',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {editText}
                  </div>
                ) : (
                  <div
                    className={element.animation ? `animate-${element.animation}` : ''}
                    style={{
                      fontFamily: style.fontFamily || 'Inter',
                      fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                      textAlign: style.textAlign || 'center',
                      textTransform: style.textTransform || 'none',
                      fontWeight: style.fontWeight || '800',
                      fontStyle: style.fontStyle || 'normal',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * previewRenderScale}px` : '0px',
                      wordSpacing: `${(style.wordSpacing ?? 0) * previewRenderScale}px`,
                      lineHeight: style.lineSpacing || 1.4,
                      textDecoration: style.textDecoration || 'none',
                      opacity: style.textOpacity ?? 1,
                      transform: `scale(${style.scale || 1})`,
                      padding: `${textElementMetrics.textPadY}px ${textElementMetrics.textPadX}px`,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      animation: element.animation && element.animation !== 'none' ? getAnimationStyle(element.animation) : 'none',
                      ...textElementEffects,
                      ...(style.textGradient ? {
                        backgroundImage: style.textGradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                      } : {
                        color: style.color || '#ffffff',
                      }),
                    }}
                  >
                    {/* Render words individually with per-word styling */}
                    {Number(style.width || 0) < 80 ? (element.text || '') : (element.text || '').split(/(\s+|\n)/).map((part, i) => {
                      if (part === '\n') return <br key={i} />;
                      if (part.match(/^\s+$/)) return <span key={i}>{part}</span>;

                      const words = (element.text || '').split(/\s+/);
                      const wordIndex = words.indexOf(part);
                      const wordStyle = element.wordStyles?.[`${element.id}-${wordIndex}`] || {};
                      const isWordClicked = wordPopup?.type === 'element' && wordPopup?.elementId === element.id && wordPopup?.wordIndex === wordIndex;
                      // Extract transform to parent - ensures text + background move together
                      const { animation, ...restWordStyle } = wordStyle;
                      const { x: renderOffsetX, y: renderOffsetY } = getWordRenderOffset(wordStyle);

                      return (
                        <span
                          key={i}
                          data-word-key={`${element.id}-${wordIndex}`}
                          style={{
                            display: 'inline-block',
                            position: 'relative',
                            transform: `translate(${renderOffsetX}px, ${renderOffsetY}px)`,
                            transition: draggingWord ? 'none' : 'transform 0.1s ease',
                            cursor: draggingWord?.captionId === element.id && draggingWord?.wordIndex === wordIndex ? 'grabbing' : 'default',
                            height: `${(style.fontSize || 18) * 1.4}px`,
                            verticalAlign: 'top',
                          }}
                          onPointerDown={(e) => handleWordMouseDown(e, element, wordIndex, true)}
                          onClick={(e) => {
                            if (Date.now() - lastDragDropTime.current < 150) return;
                            if (setWordPopup) {
                              e.stopPropagation();
                              setWordPopup({
                                type: 'element',
                                word: part,
                                elementId: element.id,
                                position: { x: e.clientX, y: e.clientY },
                                caption: null,
                                wordIndex
                              });
                            }
                          }}
                        >
                          {/* Spacer: reserves original space based on element's base font */}
                          <span
                            style={{
                              visibility: 'hidden',
                              fontFamily: style.fontFamily || 'Inter',
                              fontSize: `${(style.fontSize || 18) * previewRenderScale}px`,
                              fontWeight: style.fontWeight || 'normal',
                              whiteSpace: 'pre',
                            }}
                          >
                            {part}
                          </span>

                          {/* Absolute container centers text + background group */}
                          <span
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            {/* UNIFIED GROUP: Background wraps text - both move with parent transform */}
                            <span
                              className={animation ? `animate-${animation}` : ''}
                              style={{
                                pointerEvents: 'auto',
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: animation && animation !== 'none' ? getAnimationStyle(animation) : 'none',
                              }}
                            >
                              {/* BACKGROUND LAYER - Fixed padding, independent of text size */}
                              <span
                                style={{
                                  position: 'absolute',
                                  top: -2,
                                  left: -4,
                                  right: -4,
                                  bottom: -2,
                                  zIndex: -1,
                                  borderRadius: restWordStyle.backgroundColor || isWordClicked ? '4px' : undefined,
                                  backgroundColor: restWordStyle.backgroundColor
                                    ? `rgba(${parseInt(restWordStyle.backgroundColor.slice(1, 3), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(3, 5), 16)}, ${parseInt(restWordStyle.backgroundColor.slice(5, 7), 16)}, ${restWordStyle.backgroundOpacity ?? 0.6})`
                                    : (isWordClicked ? 'rgba(245, 166, 35, 0.24)' : undefined),
                                  border: isWordClicked ? '1px solid rgba(245, 166, 35, 0.9)' : '1px solid transparent',
                                }}
                              />

                              {/* TEXT LAYER */}
                              <span
                                style={{
                                  fontFamily: restWordStyle.fontFamily || style.fontFamily || 'Inter',
                                  fontSize: restWordStyle.fontSize ? `${restWordStyle.fontSize * previewRenderScale}px` : `${(style.fontSize || 18) * previewRenderScale}px`,
                                  fontWeight: restWordStyle.fontWeight || style.fontWeight || 'normal',
                                  fontStyle: restWordStyle.fontStyle || style.fontStyle || 'normal',
                                  textDecoration: restWordStyle.textDecoration || style.textDecoration || 'none',
                                  textTransform: restWordStyle.textTransform || style.textTransform || 'none',
                                  color: restWordStyle.color || style.color || '#ffffff',
                                  padding: restWordStyle.backgroundPadding ? `${restWordStyle.backgroundPadding}px` : (isWordClicked ? '2px 4px' : undefined),
                                  whiteSpace: 'pre',
                                  ...(restWordStyle.textGradient ? {
                                    backgroundImage: restWordStyle.textGradient,
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                  } : {}),
                                  ...(style.hasStroke ? { WebkitTextStroke: `${style.strokeWidth || 1}px ${style.strokeColor || '#000000'}` } : {}),
                                  ...(style.hasShadow ? { textShadow: `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 2}px ${style.shadowBlur || 4}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}` } : {}),
                                }}
                              >
                                {part}
                              </span>
                            </span>
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              </div>
            );
          })}

          <div
            className="absolute left-1/2 bottom-3 z-40 w-[82%] max-w-[248px] -translate-x-1/2"
            data-video-control
          >
            <Slider
              value={[localScrubTime ?? currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={([val]) => {
                isScrubbingRef.current = true;
                setLocalScrubTime(val);
              }}
              onValueCommit={([val]) => {
                isScrubbingRef.current = false;
                setLocalScrubTime(null);
                if (videoRef.current) videoRef.current.currentTime = val;
                setCurrentTime(val);
              }}
              className="cursor-pointer"
              trackClassName="h-[4px] bg-white/24"
              rangeClassName="h-[4px] bg-white"
              thumbClassName="h-3 w-3 border border-white bg-[#050505] shadow-[0_0_0_1.5px_#ffffff,0_0_0_3px_rgba(5,5,5,0.82),0_5px_12px_rgba(0,0,0,0.24)]"
            />
          </div>

          {/* Word Click Popup — REMOVED FROM HERE, rendered outside overflow-hidden below */}

          </div>
        </div>
      </div>

      <div className={`${isVideoFullscreen ? 'mt-3' : 'mt-3'} space-y-3 px-2`}>
        <div className="mx-auto lekha-glass-chip rounded-full px-2.5 py-1.5 flex w-fit items-center gap-2.5">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVideoSurfaceToggle}
              className="h-7 w-7 rounded-full hover:bg-white/10 text-white"
              data-video-control="true"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>

            <div className="flex items-center gap-2 group">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <div className="w-0 overflow-hidden group-hover:w-24 pl-2 transition-all duration-300 ease-in-out">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.05}
                  onValueChange={([val]) => {
                    setVolume(val);
                    if (val > 0) setIsMuted(false);
                  }}
                  className="w-20 cursor-pointer py-4"
                />
              </div>
            </div>
          </div>

          <span className="text-xs text-white font-mono tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">/</span>
          <span className="text-[10px] text-slate-500 font-mono tabular-nums">
            {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      {/* Word Click Popup — moved to Dashboard.jsx root level */}

      {/* Animation keyframes */}
      <style>{`
        @keyframes rise {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes pan {
          0% { transform: translateX(-30px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wipe {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes blur {
          0% { filter: blur(10px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        @keyframes succession {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes baseline {
          0% { transform: translateY(5px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes drift {
          0% { transform: translate(-10px, -10px); opacity: 0; }
          100% { transform: translate(0, 0); opacity: 1; }
        }
        @keyframes tectonic {
          0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
          100% { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes tumble {
          0% { transform: rotate(-180deg) scale(0.5); opacity: 0; }
          100% { transform: rotate(0) scale(1); opacity: 1; }
        }
        /* Word-level keyframes — include translate(-50%,-50%) in every step
           to preserve the inner span's centering transform */
        @keyframes word-rise {
          0% { transform: translate(-50%, calc(-50% + 20px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-pan {
          0% { transform: translate(calc(-50% - 30px), -50%); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-pop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes word-succession {
          0% { transform: translate(-50%, calc(-50% - 10px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.9; }
        }
        @keyframes word-baseline {
          0% { transform: translate(-50%, calc(-50% + 5px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-drift {
          0% { transform: translate(calc(-50% - 10px), calc(-50% - 10px)); opacity: 0; }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes word-tectonic {
          0% { transform: translate(calc(-50% - 20px), -50%) rotate(-5deg); opacity: 0; }
          100% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
        }
        @keyframes word-tumble {
          0% { transform: translate(-50%, -50%) rotate(-180deg) scale(0.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) rotate(0) scale(1); opacity: 1; }
        }
        /* ── Advanced – Basic ── */
        @keyframes fadeInUp {
          0% { transform: translateY(22px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeInDown {
          0% { transform: translateY(-22px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInRight {
          0% { transform: translateX(40px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes flipInX {
          0% { transform: perspective(500px) rotateX(-90deg); opacity: 0; }
          100% { transform: perspective(500px) rotateX(0); opacity: 1; }
        }
        @keyframes flipInY {
          0% { transform: perspective(500px) rotateY(-90deg); opacity: 0; }
          100% { transform: perspective(500px) rotateY(0); opacity: 1; }
        }
        @keyframes blurIn {
          0% { filter: blur(14px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        @keyframes zoomInFade {
          0% { transform: scale(0.65); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceInUp {
          0%   { transform: translateY(32px); opacity: 0; }
          60%  { transform: translateY(-8px); opacity: 1; }
          80%  { transform: translateY(4px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes skewLeft {
          0% { transform: translateX(-30px) skewX(20deg); opacity: 0; }
          100% { transform: translateX(0) skewX(0deg); opacity: 1; }
        }
        /* ── Advanced – Kinetic ── */
        @keyframes missile {
          0%   { transform: translateX(-60px) scaleX(0.6); opacity: 0; }
          65%  { transform: translateX(6px) scaleX(1.04); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }
        @keyframes shockwave {
          0%   { transform: scale(1.6); opacity: 0; filter: blur(6px); }
          55%  { transform: scale(0.94); opacity: 1; filter: blur(0); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes typewriter {
          0%   { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0% 0 0); }
        }
        @keyframes slamDown {
          0%   { transform: translateY(-55px) scaleY(1.2); opacity: 0; }
          65%  { transform: translateY(6px) scaleY(0.94); opacity: 1; }
          100% { transform: translateY(0) scaleY(1); opacity: 1; }
        }
        @keyframes fireCharge {
          0%   { transform: translateY(18px) scaleX(0.8); opacity: 0; filter: blur(5px); }
          70%  { transform: translateY(-4px) scaleX(1.02); opacity: 1; filter: blur(0); }
          100% { transform: translateY(0) scaleX(1); opacity: 1; }
        }
        @keyframes stampede {
          0%   { transform: translateX(-55px) scaleX(1.1); opacity: 0; }
          70%  { transform: translateX(5px) scaleX(0.98); opacity: 1; }
          100% { transform: translateX(0) scaleX(1); opacity: 1; }
        }
        @keyframes recoil {
          0%   { transform: translateX(0); opacity: 1; }
          20%  { transform: translateX(-10px); }
          60%  { transform: translateX(4px); }
          100% { transform: translateX(0); opacity: 1; }
        }
        /* ── Advanced – Cinematic ── */
        @keyframes irisOpen {
          0%   { clip-path: circle(0% at 50% 50%); opacity: 0.4; }
          100% { clip-path: circle(150% at 50% 50%); opacity: 1; }
        }
        @keyframes parallaxRise {
          0%   { transform: translateY(14px) scale(0.97); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes goldenRatio {
          0%   { transform: scaleX(0.618) translateX(-20px); opacity: 0; }
          100% { transform: scaleX(1) translateX(0); opacity: 1; }
        }
        @keyframes curtainSplit {
          0%   { clip-path: inset(0 50% 0 50%); opacity: 0.5; }
          100% { clip-path: inset(0 0% 0 0%); opacity: 1; }
        }
        @keyframes prestige {
          0%   { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeThroughBlack {
          0%   { opacity: 1; }
          35%  { opacity: 0; }
          65%  { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes depthPull {
          0%   { transform: scale(0.35); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slowBurn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes diagonalWipe {
          0%   { clip-path: inset(0 100% 100% 0); }
          100% { clip-path: inset(0 0% 0% 0); }
        }
        /* ── Advanced – Playful ── */
        @keyframes confettiPop {
          0%   { transform: scale(0.3) rotate(-12deg); opacity: 0; }
          55%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          75%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes stickerSlap {
          0%   { transform: scale(1.45) rotate(-6deg); opacity: 0; }
          45%  { transform: scale(0.94) rotate(1deg); opacity: 1; }
          75%  { transform: scale(1.02) rotate(0); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wobbleEntry {
          0%   { transform: translateX(-22px) rotate(-4deg); opacity: 0; }
          35%  { transform: translateX(9px) rotate(2deg); opacity: 1; }
          65%  { transform: translateX(-4px) rotate(-1deg); }
          100% { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes balloonFloat {
          0%   { transform: translateY(22px) scale(0.8); opacity: 0; }
          65%  { transform: translateY(-6px) scale(1.03); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes colorSplash {
          0%   { transform: scale(0.85); opacity: 0; filter: saturate(3) brightness(1.6); }
          50%  { transform: scale(1.06); opacity: 1; filter: saturate(2) brightness(1.3); }
          100% { transform: scale(1); opacity: 1; filter: saturate(1) brightness(1); }
        }
      `}</style>

    </div>
    {selectedDetachedWordEditor}
    </>
  );
}
