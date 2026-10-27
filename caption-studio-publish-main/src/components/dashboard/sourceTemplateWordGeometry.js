// Shared by the canvas and the server browser. A hidden source-size slot
// keeps resized and dragged template words from reflowing their neighbours.
export function getSourceTemplateVisualTargets(node) {
  if (!node) return [];
  const existingTargets = Array.from(node.querySelectorAll('[data-source-word-visual="true"], .kf-base, .kf-fill'));
  if (existingTargets.length) return existingTargets;

  const spacer = document.createElement('span');
  spacer.dataset.sourceWordSpacer = 'true';
  spacer.setAttribute('aria-hidden', 'true');
  spacer.style.visibility = 'hidden';
  spacer.style.display = 'inline-block';
  spacer.style.pointerEvents = 'none';
  spacer.style.whiteSpace = 'inherit';
  spacer.style.lineHeight = 'inherit';
  spacer.style.font = 'inherit';
  spacer.style.animation = 'none';
  spacer.style.transform = 'none';
  spacer.style.userSelect = 'none';
  Array.from(node.childNodes).forEach((child) => {
    spacer.appendChild(child.cloneNode(true));
  });

  const visual = document.createElement('span');
  visual.dataset.sourceWordVisual = 'true';
  visual.style.display = 'inline-block';
  visual.style.whiteSpace = 'nowrap';
  visual.style.transformOrigin = 'center center';
  visual.style.pointerEvents = 'none';
  while (node.firstChild) {
    visual.appendChild(node.firstChild);
  }
  node.appendChild(visual);
  node.appendChild(spacer);
  return [visual];
}

export function prepareSourceTemplateWordNode(node) {
  if (!node) return [];
  const visualTargets = getSourceTemplateVisualTargets(node);
  setSourceTemplateStyle(node, 'display', 'inline-block');
  setSourceTemplateStyle(node, 'position', 'relative');
  setSourceTemplateStyle(node, 'overflow', 'visible');
  setSourceTemplateStyle(node, 'vertical-align', 'baseline');
  setSourceTemplateStyle(node, 'line-height', 'inherit');
  visualTargets.forEach((target) => {
    const isManagedVisual = target.dataset?.sourceWordVisual === 'true';
    // Karaoke pairs keep their authored stacking: .kf-fill paints absolutely on
    // top of .kf-base inside the relative .kf-word wrapper. Forcing them into
    // inline flow (position: relative) rendered every karaoke word TWICE, side
    // by side, on the canvas (t22/t33/t36 phases).
    const isKaraokeFill = target.classList?.contains('kf-fill');
    const isKaraokeBase = target.classList?.contains('kf-base');
    setSourceTemplateStyle(target, 'display', (isKaraokeFill || isKaraokeBase) ? 'block' : 'inline-block');
    setSourceTemplateStyle(target, 'position', (isManagedVisual || isKaraokeFill) ? 'absolute' : 'relative');
    setSourceTemplateStyle(target, 'z-index', '6');
    setSourceTemplateStyle(target, 'overflow', 'visible');
    setSourceTemplateStyle(target, 'vertical-align', 'baseline');
    setSourceTemplateStyle(target, 'transform-origin', 'center center');
    // The visible child carries per-word translate/scale styles. It must remain
    // hit-testable after moving away from the original inline word box.
    setSourceTemplateStyle(target, 'pointer-events', 'auto');
    setSourceTemplateStyle(target, 'line-height', 'inherit');
    if (isManagedVisual || isKaraokeFill) {
      // The managed visual keeps its in-flow start (left: auto), so a template's
      // ::before mark (LC bracket '‹ ') stays in front of the word instead of
      // under it; the spacer after it holds the word's width.
      setSourceTemplateStyle(target, 'left', isKaraokeFill ? '0' : 'auto');
      setSourceTemplateStyle(target, 'top', '0');
      // Reset any stale transform, but WITHOUT !important — a per-word entrance
      // animation (source-word-rise/pop/...) sets `transform` via keyframes, and
      // an !important inline transform would win over the animation per the CSS
      // cascade, silently killing every transform-based word animation. The
      // positional x/y offset uses the separate `translate` property, so it still
      // composes on top of the animation.
      target.style.setProperty('transform', 'none');
      setSourceTemplateStyle(target, 'white-space', 'nowrap');
    }
  });
  return visualTargets;
}

export function setSourceTemplateStyle(node, property, value, priority = 'important') {
  if (!node || value === undefined || value === null || value === '') return;
  node.style.setProperty(property, String(value), priority);
}


export const SOURCE_TEMPLATE_WORD_GEOMETRY_SCRIPT = [
  getSourceTemplateVisualTargets, prepareSourceTemplateWordNode, setSourceTemplateStyle,
].map((helper) => helper.toString()).join("\n")
