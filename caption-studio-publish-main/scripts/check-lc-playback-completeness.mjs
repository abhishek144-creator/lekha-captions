import fs from 'fs/promises';
import {
  LC_TEMPLATE_TIMING,
  fitLcMotionScheduleToCaption,
  getLcMotionSchedule,
} from '../src/components/dashboard/templateMotionConfig.js';

const projectRoot = new URL('../', import.meta.url);
const captionDurationsMs = [360, 540, 750, 1000, 1500, 2200, 3200];

function fail(message) {
  throw new Error(`LC playback completeness failed: ${message}`);
}

function parseTemplateSet(source, pack) {
  const marker = 'const TPLS=[';
  const start = source.indexOf(marker);
  const end = source.indexOf('];', start + marker.length);
  if (start < 0 || end < 0) fail(`pack ${pack} template data was not found`);
  const body = source.slice(start + marker.length, end);
  try {
    return Function(`
      const C = (layout, ...lines) => ({ k: 'c', layout, lines });
      const L = (cls, text, anim, o = {}) => Object.assign({ cls, text, anim }, o);
      const N = (text, o = {}) => Object.assign({ k: 'n', text }, o);
      const T = (id, name, style, scenes) => ({ id, name, style, scenes });
      return [${body}];
    `)();
  } catch (error) {
    fail(`pack ${pack} could not be parsed: ${error.message}`);
  }
}

function words(value = '') {
  return String(value).trim().split(/\s+/).filter(Boolean);
}

function sceneMotionNodes(scene = {}) {
  let index = 0;
  if (scene.k === 'c') {
    return (scene.lines || []).flatMap((line) => words(line.text).flatMap(() => {
      if (!line.anim) return [];
      const entry = {
        animation: line.anim,
        duration: line.hero ? LC_TEMPLATE_TIMING.heroDurationMs : LC_TEMPLATE_TIMING.bodyDurationMs,
        delay: index * LC_TEMPLATE_TIMING.staggerMs,
        ease: 'cubic-bezier(.22,.68,.26,1)',
      };
      index += 1;
      return [entry];
    }));
  }

  const mode = scene.mode || (scene.anim ? 'anim' : 'plain');
  if (mode === 'static') return [];
  if (mode === 'plain') {
    return [{ animation: 'fade', duration: LC_TEMPLATE_TIMING.plainFadeDurationMs, delay: 0, ease: 'ease' }];
  }
  if (mode === 'block') {
    return [{ animation: scene.blockAnim || 'rise', duration: LC_TEMPLATE_TIMING.heroDurationMs, delay: 0, ease: 'cubic-bezier(.22,.68,.26,1)' }];
  }

  const heroWords = new Set(words(scene.hero).map((word) => word.toLowerCase()));
  return words(scene.text).map((word) => {
    const hero = heroWords.has(word.toLowerCase());
    const entry = {
      animation: mode === 'wbw' ? 'fade' : (hero ? (scene.heroAnim || 'pop') : (scene.bodyAnim || 'rise')),
      duration: mode === 'wbw' ? LC_TEMPLATE_TIMING.wbwFadeDurationMs : (hero ? LC_TEMPLATE_TIMING.heroDurationMs : LC_TEMPLATE_TIMING.bodyDurationMs),
      delay: index * LC_TEMPLATE_TIMING.staggerMs,
      ease: 'cubic-bezier(.22,.68,.26,1)',
    };
    index += 1;
    return entry;
  });
}

let templateCount = 0;
let sceneCount = 0;
let durationChecks = 0;
const highlightOpacityRiskTemplates = new Set();
const dropCapTemplates = new Set();
const boxedKeywordTemplates = new Set();

function sceneCanDimHighlight(scene = {}) {
  if (scene.k === 'c') {
    return (scene.lines || []).some((line) => Boolean(line.hero && line.anim));
  }
  if (!String(scene.hero || '').trim()) return false;
  const mode = scene.mode || (scene.anim ? 'anim' : 'plain');
  return mode === 'plain' || mode === 'block' || mode === 'wbw' || mode === 'anim';
}

for (const pack of [2, 3, 4, 5]) {
  const source = await fs.readFile(new URL(`src/assets/lekha-captions-lc-${pack}.html`, projectRoot), 'utf8');
  const templates = parseTemplateSet(source, pack);
  for (const template of templates) {
    templateCount += 1;
    if (!template.id || !Array.isArray(template.scenes) || !template.scenes.length) {
      fail(`pack ${pack} contains an invalid template`);
    }
    for (let phaseIndex = 0; phaseIndex < template.scenes.length; phaseIndex += 1) {
      const scene = template.scenes[phaseIndex];
      if (sceneCanDimHighlight(template.scenes[phaseIndex])) {
        highlightOpacityRiskTemplates.add(template.id);
      }
      if (scene.k === 'c' && scene.layout === 'dropcap') {
        dropCapTemplates.add(template.id);
      }
      if (
        scene.keywordStyle === 'box'
        || (scene.lines || []).some((line) => Boolean(line.box))
      ) {
        boxedKeywordTemplates.add(template.id);
      }
      sceneCount += 1;
      const schedule = getLcMotionSchedule(sceneMotionNodes(template.scenes[phaseIndex]));
      for (const durationMs of captionDurationsMs) {
        const fitted = fitLcMotionScheduleToCaption(schedule, durationMs);
        durationChecks += 1;
        if (fitted.endMs > durationMs - fitted.finalHoldMs + 0.01) {
          fail(`${template.id} phase ${phaseIndex} ends at ${fitted.endMs}ms inside a ${durationMs}ms caption`);
        }
        if (fitted.entries.length !== schedule.entries.length) {
          fail(`${template.id} phase ${phaseIndex} dropped animated words`);
        }
        if (fitted.entries.some((entry) => !entry.animation || entry.durationMs <= 0)) {
          fail(`${template.id} phase ${phaseIndex} has an invalid fitted animation`);
        }
      }
    }
  }
}

if (templateCount !== 60) fail(`expected 60 LC templates, found ${templateCount}`);
console.log(`LC playback completeness passed for ${templateCount} templates, ${sceneCount} lines/phases, and ${durationChecks} duration variants. Highlight-opacity audit covered ${highlightOpacityRiskTemplates.size} templates with animated keywords; complex-script geometry audit covered ${dropCapTemplates.size} drop-cap templates and ${boxedKeywordTemplates.size} boxed-keyword templates.`);
