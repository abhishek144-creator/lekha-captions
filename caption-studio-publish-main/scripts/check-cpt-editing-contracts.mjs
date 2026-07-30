import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveCptWordSnap } from '../src/components/dashboard/cptSmartGuides.js';
import { getCaptionWordStartTime } from '../src/components/dashboard/cptMotion.js';

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
  'transcription timing must drive the CPT reveal clock',
);
assert.equal(
  getCaptionWordStartTime({ start_time: 2, end_time: 6 }, 1, 4),
  3,
  'captions without transcription timing should use an even fallback',
);

const videoPlayerSource = await readFile(
  new URL('../src/components/dashboard/VideoPlayer.jsx', import.meta.url),
  'utf8',
);
const exportPanelSource = await readFile(
  new URL('../src/components/dashboard/ExportPanel.jsx', import.meta.url),
  'utf8',
);
const exportRendererSource = await readFile(
  new URL('./render_template_overlay.mjs', import.meta.url),
  'utf8',
);
assert.match(
  videoPlayerSource,
  /nextWordStyle\.cptCanvasXPercent = absXPct[\s\S]*nextWordStyle\.cptCanvasYPercent = absYPct/,
  'drag commit must preserve the exact canvas-space CPT drop point',
);
assert.match(
  exportPanelSource,
  /hasCptCanvasPosition[\s\S]*abs_x_pct: vidPos\.x[\s\S]*abs_y_pct: vidPos\.y/,
  'export serialization must convert the canvas CPT point to video coordinates',
);
assert.match(
  exportRendererSource,
  /unlockPositionedWordOverflow[\s\S]*overflow-x[\s\S]*clip-path[\s\S]*contain/,
  'export must unlock clipping ancestors for far-displaced source-template words',
);
assert.match(
  videoPlayerSource,
  /captionHasCreativelyPositionedWords\(caption\)[\s\S]*animation:\s*'none'[\s\S]*transition:\s*'none'/,
  'canvas CPT words must reveal with animation and transition disabled',
);
assert.doesNotMatch(
  videoPlayerSource,
  /getCaptionCptAnimation|resolveCptAnimationType|cptAnimationAtDragStart/,
  'dragging must not capture or reconstruct template motion for a CPT',
);
assert.match(
  exportRendererSource,
  /if \(isCptCaption\)[\s\S]*setImportant\(target, 'animation', 'none'\)[\s\S]*setImportant\(target, 'transition', 'none'\)/,
  'exported CPT words must disable authored motion while keeping timed reveal',
);
assert.doesNotMatch(
  exportPanelSource,
  /'cptAnimation'/,
  'export payloads must not serialize obsolete CPT animation metadata',
);

console.log('CPT editing contracts passed.');
