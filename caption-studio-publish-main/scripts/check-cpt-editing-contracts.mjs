import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveCptWordSnap } from '../src/components/dashboard/cptSmartGuides.js';
import {
  advanceCaptionWordRevealIndex,
  getCaptionWordRevealIndex,
  getCaptionWordRevealTimes,
  getCaptionWordStartTime,
} from '../src/components/dashboard/cptMotion.js';

const rect = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});

{
  const result = resolveCptWordSnap({
    draggedRect: rect(10, 42, 30, 12),
    siblingRects: [rect(70, 40, 34, 12)],
    minGap: 6,
  });
  assert.equal(result.deltaY, -2, 'top edges should snap together');
  assert.ok(
    result.guides.some((guide) => guide.type === 'horizontal' && guide.kind === 'top'),
    'top-edge alignment should draw a horizontal guide',
  );
  assert.ok(
    result.guides.some((guide) => guide.type === 'horizontal' && guide.kind === 'bottom'),
    'equal-height words should also draw the lower-edge guide',
  );
}

{
  const result = resolveCptWordSnap({
    draggedRect: rect(42, 10, 30, 16),
    siblingRects: [rect(40, 50, 30, 16)],
    minGap: 6,
  });
  assert.equal(result.deltaX, -2, 'left edges should snap together');
  assert.ok(
    result.guides.some((guide) => guide.type === 'vertical' && guide.kind === 'left'),
    'left-edge alignment should draw a vertical guide',
  );
  assert.ok(
    result.guides.some((guide) => guide.type === 'vertical' && guide.kind === 'right'),
    'equal-width words should also draw the right-edge guide',
  );
}

{
  const result = resolveCptWordSnap({
    draggedRect: rect(0, 10, 30, 16),
    siblingRects: [rect(45, 10, 30, 16)],
    deltaX: 7,
    minGap: 6,
  });
  assert.equal(result.rect.right, 39, 'adjacent right edge should magnetize to the minimum gap');
  assert.ok(
    result.guides.some((guide) => guide.type === 'spacing-horizontal'),
    'side-by-side words should show a horizontal spacing marker',
  );
}

{
  const sibling = rect(40, 10, 30, 16);
  const result = resolveCptWordSnap({
    draggedRect: rect(0, 10, 30, 16),
    siblingRects: [sibling],
    deltaX: 20,
    minGap: 6,
  });
  assert.ok(result.rect.right <= sibling.left - 6, 'a dragged word must not overlap its sibling');
}

{
  const result = resolveCptWordSnap({
    draggedRect: rect(20, 0, 32, 14),
    siblingRects: [rect(20, 30, 32, 14)],
    deltaY: 9,
    minGap: 6,
  });
  assert.equal(result.rect.bottom, 24, 'stacked word edges should magnetize vertically');
  assert.ok(
    result.guides.some((guide) => guide.type === 'spacing-vertical'),
    'stacked words should show a vertical spacing marker',
  );
}

assert.equal(
  getCaptionWordStartTime({
    start_time: 2,
    end_time: 6,
    words: [{ word: 'one', start: 2.1 }, { word: 'two', start: 3.35 }],
  }, 1, 2),
  3.35,
  'transcription timing must drive the explicit word-by-word reveal clock',
);
assert.equal(
  getCaptionWordStartTime({ start_time: 2, end_time: 6 }, 1, 4),
  3,
  'captions without transcription timing should use an even fallback',
);

{
  const caption = {
    start_time: 2,
    end_time: 4,
    words: [
      { word: 'one', start: 2 },
      { word: 'two', start: 2 },
      { word: 'three', start: 2.01 },
    ],
  };
  const revealTimes = getCaptionWordRevealTimes(caption, 3);
  assert.ok(
    revealTimes[1] - revealTimes[0] >= 0.049
    && revealTimes[2] - revealTimes[1] >= 0.049,
    `duplicate transcript timestamps must be serialized (${revealTimes.join(', ')})`,
  );
  assert.equal(
    getCaptionWordRevealIndex(caption, revealTimes[1] - 0.001, 3),
    0,
    'the second word must stay hidden until its own reveal boundary',
  );
}

{
  const caption = {
    start_time: 0,
    end_time: 1,
    words: [
      { word: 'one', start: 0.94 },
      { word: 'two', start: 0.94 },
      { word: 'three', start: 0.94 },
      { word: 'four', start: 0.95 },
    ],
  };
  const revealTimes = getCaptionWordRevealTimes(caption, 4);
  const revealFrames = revealTimes.map((time) => Math.floor((time * 24) + 0.0001));
  assert.equal(
    new Set(revealFrames).size,
    revealFrames.length,
    `every reveal must occupy its own 24fps frame (${revealTimes.join(', ')})`,
  );

  const paintedIndexes = [];
  let paintedIndex;
  for (let paint = 0; paint < 4; paint += 1) {
    paintedIndex = advanceCaptionWordRevealIndex(paintedIndex, 3);
    paintedIndexes.push(paintedIndex);
  }
  assert.deepEqual(
    paintedIndexes,
    [0, 1, 2, 3],
    'a delayed browser update must catch up one word per paint instead of revealing a group',
  );
}

// VideoPlayer.jsx plus its extracted stylesheet module — read both so the
// contracts below stay satisfied wherever the declaration actually lives.
const videoPlayerSource = (await readFile(
  new URL('../src/components/dashboard/VideoPlayer.jsx', import.meta.url),
  'utf8',
)) + '\n' + (await readFile(
  new URL('../src/components/dashboard/videoPlayerTemplateStyles.jsx', import.meta.url),
  'utf8',
));
const exportPanelSource = await readFile(
  new URL('../src/components/dashboard/ExportPanel.jsx', import.meta.url),
  'utf8',
);
const exportRendererSource = await readFile(
  new URL('./render_template_overlay.mjs', import.meta.url),
  'utf8',
);
const backendMainSource = await readFile(
  new URL('../backend/main.py', import.meta.url),
  'utf8',
);
assert.match(
  videoPlayerSource,
  /nextWordStyle\.cptCanvasXPercent = absXPct[\s\S]*nextWordStyle\.cptCanvasYPercent = absYPct/,
  'drag commit must preserve the exact canvas-space CPT drop point',
);
assert.match(
  exportPanelSource,
  /Export is server-rendered from persisted editor state[\s\S]*WORD_GEOMETRY_KEYS[\s\S]*cptCanvasXPercent[\s\S]*cptCanvasYPercent/,
  'export serialization must use persisted CPT geometry without consulting the preview DOM',
);
assert.doesNotMatch(
  exportPanelSource,
  /getCanvasWordSnapshot|containerToVideo|data-export-measure/,
  'export serialization must not derive authoritative layout from client-side DOM measurements',
);
assert.match(
  exportPanelSource + exportRendererSource,
  /cptPaintedFontSize[\s\S]*cptPaintedFontFamily[\s\S]*cptPaintedFontWeight/,
  'CPT export must preserve the final painted word metrics as well as its center',
);
assert.match(
  backendMainSource,
  /_CLIENT_RENDER_HINT_FIELDS[\s\S]*"word_layouts"[\s\S]*def _strip_client_render_hints/,
  'the backend must strip legacy client render hints before server-side rendering',
);
assert.doesNotMatch(
  exportPanelSource + exportRendererSource,
  /cptPreviewFontPx|cptPreviewFontFamily/,
  'CPT export must not reapply measured template font sizes and amplify hero classes',
);
assert.match(
  videoPlayerSource,
  /max-width:\s*var\(--applied-template-width[\s\S]*height:\s*calc\(var\(--applied-template-width[^;]+1\.28\)/,
  'LC fullscreen must scale the logical template stage uniformly instead of reflowing it',
);
assert.match(
  exportRendererSource,
  /unlockPositionedWordOverflow[\s\S]*overflow-x[\s\S]*clip-path[\s\S]*contain/,
  'export must unlock clipping ancestors for far-displaced source-template words',
);
assert.match(
  exportRendererSource,
  /const targetRect = target\.getBoundingClientRect\(\)[\s\S]*absoluteWordPosition\.x[\s\S]*absoluteWordPosition\.y/,
  'export must center each visual target independently at its saved canvas point',
);
assert.match(
  exportRendererSource,
  /captionHasAbsoluteCptLayout[\s\S]*buildAbsoluteCptMarkup[\s\S]*data-caption-absolute-cpt/,
  'a complete canvas CPT must bypass sentence-flow templates and render as absolute words',
);
assert.match(
  videoPlayerSource,
  /captionHasCreativelyPositionedWords\(caption\)[\s\S]*hasSelectedWordAnimation[\s\S]*animation:\s*'none'[\s\S]*transition:\s*'none'/,
  'canvas CPT words must remain stable unless the floating word editor selects an animation',
);
assert.match(
  videoPlayerSource,
  /shouldFreezeCptMotion = \([\s\S]*isCptCaption[\s\S]*wordHasCreativePosition\(wordStyle\)[\s\S]*!hasSelectedWordAnimation[\s\S]*animValue = \(!shouldFreezeCptMotion && hasSelectedWordAnimation\)[\s\S]*if \(shouldFreezeCptMotion\)/,
  'only the displaced source-template word may freeze; sibling words must retain their authored layout and motion',
);
assert.match(
  videoPlayerSource,
  /if \(!hasStyle && node\.dataset\.sourceWordStyled !== 'true'\)[\s\S]*if \(!hasStyle\) \{/,
  'untouched source-template siblings must bypass per-word style rewriting after another word is displaced',
);
assert.doesNotMatch(
  videoPlayerSource,
  /isAdvancedTemplateCaptionEditingActive/,
  'advanced-template word editing must not switch the whole caption to a different renderer',
);
assert.match(
  videoPlayerSource,
  /releaseClientDeltaX = Number\.isFinite\(upEvent\?\.clientX\)[\s\S]*releaseClientDeltaY = Number\.isFinite\(upEvent\?\.clientY\)[\s\S]*x: dragState\.initialX \+ releaseClientDeltaX/,
  'drag commit must use the actual pointer-up coordinates rather than a stale final move event',
);
assert.match(
  videoPlayerSource,
  /selectedWordAnimation = selectedWordStyle\.animation[\s\S]*animation: selectedWordAnimation/,
  'the selected detached-word editor must visibly preview its chosen animation',
);
assert.match(
  videoPlayerSource,
  /const isCptWordPending[\s\S]*isPlaying[\s\S]*!isCaptionCptAdjustmentActive[\s\S]*wordIndex > currentIdx/,
  'CPT reveal must run only during playback and never while a word is being adjusted',
);
assert.match(
  videoPlayerSource,
  /Editing stays fully visible; playback and[\s\S]*build the sentence cumulatively, one word at a time, with no motion/,
  'canvas must separate the fully visible editing state from playback reveal',
);
assert.match(
  videoPlayerSource,
  /hasCptWords && isPlaying && index > currentIdx[\s\S]{0,180}opacity', '0'[\s\S]{0,180}else if \(hasCptWords\)[\s\S]{0,120}opacity', '1'/,
  'source-template CPT words must reveal only in playback and all show while editing',
);
assert.match(
  videoPlayerSource,
  /function handleWordMouseDown[\s\S]*isPlayingRef\.current[\s\S]*videoRef\.current\?\.pause\(\)[\s\S]*setIsPlaying\(false\)/,
  'starting a word drag must pause playback for a stable editing canvas',
);
assert.doesNotMatch(
  videoPlayerSource,
  /getCaptionCptAnimation|resolveCptAnimationType|cptAnimationAtDragStart/,
  'dragging must not capture or reconstruct template motion for a CPT',
);
assert.match(
  exportRendererSource,
  /if \(isCptCaption\)[\s\S]*setImportant\(target, 'animation', 'none'\)[\s\S]*setImportant\(target, 'transition', 'none'\)/,
  'exported CPT words must disable all authored motion',
);
assert.match(
  exportRendererSource,
  /isCptCaption && index > currentCptIndex[\s\S]{0,120}opacity', '0'[\s\S]{0,160}else if \(isCptCaption\)[\s\S]{0,120}opacity', '1'/,
  'exported CPT words must reveal cumulatively',
);
assert.match(
  exportRendererSource,
  /captionHasCptWordStyles\(caption\)[\s\S]{0,120}payload\.style\?\.show_inactive === false/,
  'export compositor must segment every CPT word boundary',
);
assert.doesNotMatch(
  exportPanelSource,
  /'cptAnimation'/,
  'export payloads must not serialize obsolete CPT animation metadata',
);

console.log('CPT editing contracts passed.');
