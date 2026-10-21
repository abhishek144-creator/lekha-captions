// Kept in its own file because template-card preview frames also run this
// exact source as a classic script (see templatePreviewScripts.js), which the
// production CSP allows by hash.

// LC source files already describe every motion node with its own keyframe,
// delay, duration, and easing. Preserve that authored schedule verbatim instead
// of deriving a second, caption-length-dependent reveal sequence. The canvas,
// template preview, and export renderer all consume this serializable helper.
export function getLcMotionSchedule(nodes = []) {
  const toMs = (value, fallback = 0) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    const match = String(value ?? '').trim().match(/^(-?\d*\.?\d+)(ms|s)?$/i);
    if (!match) return fallback;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return fallback;
    return match[2]?.toLowerCase() === 's' ? amount * 1000 : amount;
  };

  const entries = (Array.isArray(nodes) ? nodes : []).map((node) => {
    const durationMs = Math.max(0, toMs(node?.duration, 430));
    const delayMs = Math.max(0, toMs(node?.delay, 0));
    return {
      animation: String(node?.animation || '').trim(),
      durationMs,
      delayMs,
      ease: String(node?.ease || 'cubic-bezier(.22,.68,.26,1)').trim(),
    };
  });

  return {
    entries,
    endMs: entries.reduce((latest, entry) => Math.max(latest, entry.delayMs + entry.durationMs), 0),
  };
}
