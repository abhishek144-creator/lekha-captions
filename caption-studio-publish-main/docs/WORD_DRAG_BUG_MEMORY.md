# Word Drag Bug Memory

## Bug: detached word drag made other words disappear or snap back

When dragging one word out of the main caption sentence, the remaining words could disappear while paused/editing, and the dragged word could jump back or shift when selected again.

Root causes:
- Detached caption words were saved with both absolute placement (`abs_x_pct`, `abs_y_pct`) and offset placement (`x`, `y`, `x_pct`, `y_pct`). The renderer then applied both, causing jump/snap-back behavior.
- The editor applied word-by-word reveal hiding while paused after a word was detached. That made later words unavailable for editing even though they appeared during video playback.

Fix pattern:
- For detached caption words, save the final location in `abs_x_pct` / `abs_y_pct` and reset `x`, `y`, `x_pct`, and `y_pct` to `0`.
- Only apply word-by-word hiding while the video is actually playing.
- While paused/editing, keep all words in the caption visible and selectable.

Regression check:
- Drag the first word in a caption like `Checking highlight`.
- After release, the second word should still be visible/selectable on the canvas.
- Saved style for the dragged word should have `x`, `y`, `x_pct`, `y_pct` all set to `0`.
