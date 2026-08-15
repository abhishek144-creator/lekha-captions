const centerX = (rect) => rect.left + rect.width / 2;
const centerY = (rect) => rect.top + rect.height / 2;

const moveRect = (rect, dx, dy) => ({
  ...rect,
  left: rect.left + dx,
  right: rect.right + dx,
  top: rect.top + dy,
  bottom: rect.bottom + dy,
});

const rangesOverlap = (a1, a2, b1, b2, tolerance = 0) => (
  Math.min(a2, b2) - Math.max(a1, b1) >= -tolerance
);

const rectsOverlap = (a, b) => (
  a.left < b.right
  && a.right > b.left
  && a.top < b.bottom
  && a.bottom > b.top
);

const chooseClosest = (current, candidate, threshold) => {
  if (Math.abs(candidate.distance) > threshold) return current;
  if (!current || Math.abs(candidate.distance) < Math.abs(current.distance)) return candidate;
  return current;
};

/**
 * Resolve word-to-word smart snapping in viewport pixels.
 *
 * Alignment snaps like edges/centres together. Magnetic snaps place adjacent
 * word edges at `minGap`. The final collision pass guarantees that no sibling
 * word can be dropped underneath the dragged word.
 */
export function resolveCptWordSnap({
  draggedRect,
  siblingRects = [],
  deltaX = 0,
  deltaY = 0,
  alignThreshold = 5,
  magneticThreshold = 10,
  minGap = 6,
}) {
  const rawRect = moveRect(draggedRect, deltaX, deltaY);
  let bestX = null;
  let bestY = null;

  siblingRects.forEach((targetRect) => {
    const rowRelated = rangesOverlap(
      rawRect.top,
      rawRect.bottom,
      targetRect.top,
      targetRect.bottom,
      Math.max(rawRect.height, targetRect.height) * 0.35,
    );
    const columnRelated = rangesOverlap(
      rawRect.left,
      rawRect.right,
      targetRect.left,
      targetRect.right,
      Math.max(rawRect.width, targetRect.width) * 0.25,
    );

    const xAlignments = [
      { kind: 'left', distance: targetRect.left - rawRect.left, value: targetRect.left },
      { kind: 'center', distance: centerX(targetRect) - centerX(rawRect), value: centerX(targetRect) },
      { kind: 'right', distance: targetRect.right - rawRect.right, value: targetRect.right },
    ];
    xAlignments.forEach((candidate) => {
      bestX = chooseClosest(bestX, {
        ...candidate,
        mode: 'alignment',
        targetRect,
      }, alignThreshold);
    });

    const yAlignments = [
      { kind: 'top', distance: targetRect.top - rawRect.top, value: targetRect.top },
      { kind: 'middle', distance: centerY(targetRect) - centerY(rawRect), value: centerY(targetRect) },
      { kind: 'bottom', distance: targetRect.bottom - rawRect.bottom, value: targetRect.bottom },
    ];
    yAlignments.forEach((candidate) => {
      bestY = chooseClosest(bestY, {
        ...candidate,
        mode: 'alignment',
        targetRect,
      }, alignThreshold);
    });

    if (rowRelated) {
      [
        {
          kind: 'after',
          distance: targetRect.right + minGap - rawRect.left,
          value: targetRect.right,
        },
        {
          kind: 'before',
          distance: targetRect.left - minGap - rawRect.right,
          value: targetRect.left,
        },
      ].forEach((candidate) => {
        bestX = chooseClosest(bestX, {
          ...candidate,
          mode: 'magnetic',
          targetRect,
        }, magneticThreshold);
      });
    }

    if (columnRelated) {
      [
        {
          kind: 'below',
          distance: targetRect.bottom + minGap - rawRect.top,
          value: targetRect.bottom,
        },
        {
          kind: 'above',
          distance: targetRect.top - minGap - rawRect.bottom,
          value: targetRect.top,
        },
      ].forEach((candidate) => {
        bestY = chooseClosest(bestY, {
          ...candidate,
          mode: 'magnetic',
          targetRect,
        }, magneticThreshold);
      });
    }
  });

  let resolvedDeltaX = deltaX + (bestX?.distance || 0);
  let resolvedDeltaY = deltaY + (bestY?.distance || 0);
  let resolvedRect = moveRect(draggedRect, resolvedDeltaX, resolvedDeltaY);
  let collisionGuide = null;

  // A magnetic edge is a hard boundary, not only a visual hint. Resolve each
  // collision by the shortest escape and repeat for tightly packed clusters.
  for (let pass = 0; pass < Math.max(1, siblingRects.length * 2); pass += 1) {
    const collision = siblingRects.find((rect) => rectsOverlap(resolvedRect, rect));
    if (!collision) break;

    const escapes = [
      { axis: 'x', distance: collision.left - minGap - resolvedRect.right, kind: 'before' },
      { axis: 'x', distance: collision.right + minGap - resolvedRect.left, kind: 'after' },
      { axis: 'y', distance: collision.top - minGap - resolvedRect.bottom, kind: 'above' },
      { axis: 'y', distance: collision.bottom + minGap - resolvedRect.top, kind: 'below' },
    ];
    const dominantAxis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';
    escapes.sort((left, right) => {
      const leftCost = Math.abs(left.distance) + (left.axis === dominantAxis ? 0 : minGap * 0.35);
      const rightCost = Math.abs(right.distance) + (right.axis === dominantAxis ? 0 : minGap * 0.35);
      return leftCost - rightCost;
    });
    const escape = escapes[0];
    if (escape.axis === 'x') resolvedDeltaX += escape.distance;
    else resolvedDeltaY += escape.distance;
    resolvedRect = moveRect(draggedRect, resolvedDeltaX, resolvedDeltaY);
    collisionGuide = { ...escape, targetRect: collision, mode: 'magnetic' };
  }

  const guides = [];
  const resolvedCenterX = centerX(resolvedRect);
  const resolvedCenterY = centerY(resolvedRect);

  if (bestX?.mode === 'alignment') {
    const target = bestX.targetRect;
    const matchingEdges = [
      { kind: 'left', draggedValue: resolvedRect.left, targetValue: target.left },
      { kind: 'right', draggedValue: resolvedRect.right, targetValue: target.right },
    ].filter(({ draggedValue, targetValue }) => Math.abs(draggedValue - targetValue) <= 0.75);
    const verticalGuides = matchingEdges.length > 0
      ? matchingEdges
      : [{ kind: bestX.kind, draggedValue: bestX.value, targetValue: bestX.value }];

    verticalGuides.forEach(({ kind, targetValue }) => {
      guides.push({
        type: 'vertical',
        kind,
        x: targetValue,
        y1: Math.min(resolvedRect.top, target.top),
        y2: Math.max(resolvedRect.bottom, target.bottom),
      });
    });
  }
  if (bestY?.mode === 'alignment') {
    const target = bestY.targetRect;
    const matchingEdges = [
      { kind: 'top', draggedValue: resolvedRect.top, targetValue: target.top },
      { kind: 'bottom', draggedValue: resolvedRect.bottom, targetValue: target.bottom },
    ].filter(({ draggedValue, targetValue }) => Math.abs(draggedValue - targetValue) <= 0.75);
    const horizontalGuides = matchingEdges.length > 0
      ? matchingEdges
      : [{ kind: bestY.kind, draggedValue: bestY.value, targetValue: bestY.value }];

    horizontalGuides.forEach(({ kind, targetValue }) => {
      guides.push({
        type: 'horizontal',
        kind,
        y: targetValue,
        x1: Math.min(resolvedRect.left, target.left),
        x2: Math.max(resolvedRect.right, target.right),
      });
    });
  }

  const magneticX = collisionGuide?.axis === 'x'
    ? collisionGuide
    : bestX?.mode === 'magnetic'
      ? bestX
      : null;
  if (magneticX) {
    const target = magneticX.targetRect;
    const placedAfter = resolvedRect.left >= target.right;
    guides.push({
      type: 'spacing-horizontal',
      x1: placedAfter ? target.right : resolvedRect.right,
      x2: placedAfter ? resolvedRect.left : target.left,
      y: Math.min(
        Math.max(resolvedCenterY, target.top),
        target.bottom,
      ),
    });
  }

  const magneticY = collisionGuide?.axis === 'y'
    ? collisionGuide
    : bestY?.mode === 'magnetic'
      ? bestY
      : null;
  if (magneticY) {
    const target = magneticY.targetRect;
    const placedBelow = resolvedRect.top >= target.bottom;
    guides.push({
      type: 'spacing-vertical',
      x: Math.min(
        Math.max(resolvedCenterX, target.left),
        target.right,
      ),
      y1: placedBelow ? target.bottom : resolvedRect.bottom,
      y2: placedBelow ? resolvedRect.top : target.top,
    });
  }

  return {
    deltaX: resolvedDeltaX,
    deltaY: resolvedDeltaY,
    rect: resolvedRect,
    guides,
  };
}
