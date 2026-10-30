// A newly chosen animation starts at 2x (owner, 2026-10-30): the floating word
// editor (words and CPT words) and the Animate tab (lines, words, text
// elements). A speed the user already set is kept, and items saved before
// without a speed keep playing as saved (the renderers' fallback stays 1x).
export const DEFAULT_ANIMATION_SPEED = 2

/** @type {(item: Record<string, any>, animation: string) => Record<string, any>} */
export const withAnimationChoice = (item = {}, animation) => (
  animation && animation !== 'none' && item.animationSpeed == null
    ? { ...item, animation, animationSpeed: DEFAULT_ANIMATION_SPEED }
    : { ...item, animation }
)
