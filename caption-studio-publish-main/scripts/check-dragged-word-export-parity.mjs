import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rendererPath = path.join(projectRoot, 'scripts', 'render_template_overlay.mjs')
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'lekha-dragged-word-export-'))
const outputDir = path.join(tempRoot, 'overlay')
const payloadPath = path.join(tempRoot, 'payload.json')

const payload = {
  video_width: 360,
  video_height: 640,
  duration: 1,
  output_dir: outputDir,
  style: {
    font_family: 'Inter',
    font_size: 28,
    font_weight: '800',
    position_x: 50,
    position_y: 75,
    text_color: '#ffffff',
    secondary_color: '#ffe600',
    has_background: false,
    show_inactive: true,
    word_spacing: 1,
    line_spacing: 1.25,
    text_opacity: 1,
    scale: 1,
    fps: 24,
    preview_width: 240,
    preview_height: 640,
  },
  captions: [{
    id: 'drag-test',
    text: 'ONE TWO THREE FOUR',
    start_time: 0,
    end_time: 1,
    animation: 'fade',
    animation_speed: 1,
    is_text_element: false,
    words: [
      { word: 'ONE', start: 0, end: 0.1 },
      { word: 'TWO', start: 0.1, end: 0.55 },
      // Providers can assign adjacent short words the same boundary. The CPT
      // renderer must still serialize them into separate visible beats.
      { word: 'THREE', start: 0.1, end: 0.9 },
      { word: 'FOUR', start: 0.9, end: 1 },
    ],
    word_styles: {
      'drag-test-1': {
        abs_x_pct: 20,
        abs_y_pct: 20,
        x: 0,
        y: 0,
        x_pct: 0,
        y_pct: 0,
      },
      'drag-test-2': {
        abs_x_pct: 80,
        abs_y_pct: 30,
        x: 0,
        y: 0,
        x_pct: 0,
        y_pct: 0,
      },
      'drag-test-3': {
        x: 48,
        y: -48,
        x_pct: 10,
        y_pct: -10,
      },
    },
  }],
}

try {
  await writeFile(payloadPath, JSON.stringify(payload), 'utf8')
  execFileSync(process.execPath, [rendererPath, payloadPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      TEMPLATE_OVERLAY_POSITION_AUDIT: '1',
    },
    encoding: 'utf8',
    stdio: 'pipe',
  })

  const audit = JSON.parse(
    await readFile(path.join(outputDir, 'word-position-audit.json'), 'utf8'),
  )
  assert.ok(audit.length > 0, 'renderer did not produce a word-position audit')

  for (const frame of audit) {
    const absoluteWords = frame.words.filter((word) => word.mode === 'absolute')
    const relativeWords = frame.words.filter((word) => word.mode === 'relative')
    assert.equal(absoluteWords.length, 2, 'both detached words must render in every caption frame')
    assert.equal(relativeWords.length, 1, 'the template-style offset word must render in every caption frame')
    for (const word of absoluteWords) {
      assert.equal(word.found, true, `${word.key} was not found in the export DOM`)
      assert.equal(word.visible, true, `${word.key} was not visible in the export DOM`)
      assert.ok(
        Math.abs(word.actual_x_pct - word.expected_x_pct) <= 0.5,
        `${word.key} exported at x=${word.actual_x_pct}, expected ${word.expected_x_pct}`,
      )
      assert.ok(
        Math.abs(word.actual_y_pct - word.expected_y_pct) <= 0.5,
        `${word.key} exported at y=${word.actual_y_pct}, expected ${word.expected_y_pct}`,
      )
    }
    assert.match(
      relativeWords[0].applied_translate,
      /^36px -64px$/,
      'relative CPT offsets must use the canvas-relative percentages saved by the preview',
    )
    // Setting the translate is not the same as moving the word: CSS transforms
    // do not apply to non-replaced inline boxes, so a CPT could carry the right
    // value and still export at its original spot. Assert the honoured offset.
    assert.ok(
      Math.abs(relativeWords[0].effective_dx - 36) <= 1
      && Math.abs(relativeWords[0].effective_dy - -64) <= 1,
      'relative CPT offsets must actually move the word, not just set translate '
      + `(moved ${relativeWords[0].effective_dx}/${relativeWords[0].effective_dy}, `
      + `display=${relativeWords[0].target_display})`,
    )
    for (const word of absoluteWords) {
      assert.ok(
        Math.abs(word.effective_dx) > 1 || Math.abs(word.effective_dy) > 1,
        `${word.key} carried a translate that the browser ignored (display=${word.target_display})`,
      )
    }
  }

  // Playback/export builds a displaced-word CPT cumulatively. Pending words
  // remain mounted at opacity 0, and each rendered step adds exactly one word.
  const revealedPerFrame = audit.map((frame) => ({
    time: frame.time,
    revealed: frame.words.filter((word) => Number(word.word_opacity ?? 1) > 0.5).length,
    total: frame.words.length,
  }))
  const firstFrame = revealedPerFrame[0]
  const lastFrame = revealedPerFrame[revealedPerFrame.length - 1]
  assert.ok(
    firstFrame.revealed < firstFrame.total,
    `a CPT must not appear fully formed on its first playback frame (${firstFrame.revealed}/${firstFrame.total} revealed)`,
  )
  assert.equal(
    lastFrame.revealed,
    lastFrame.total,
    'a CPT must complete the full sentence by the end of the caption',
  )
  for (let index = 1; index < revealedPerFrame.length; index += 1) {
    const addedWords = revealedPerFrame[index].revealed - revealedPerFrame[index - 1].revealed
    assert.ok(
      addedWords >= 0 && addedWords <= 1,
      `a CPT must add exactly one word per step, but changed by ${addedWords} at t=${revealedPerFrame[index].time}`,
    )
  }
  const observedRevealCounts = revealedPerFrame
    .map((frame) => frame.revealed)
    .filter((revealed, index, values) => index === 0 || revealed !== values[index - 1])
  assert.deepEqual(
    observedRevealCounts,
    Array.from(
      { length: lastFrame.total + (firstFrame.revealed === 0 ? 1 : 0) },
      (_, index) => index + (firstFrame.revealed === 0 ? 0 : 1),
    ),
    `export must contain every one-word reveal state (${observedRevealCounts.join(', ')})`,
  )

  // Dragging converts the line to a CPT, but no caption, template, or word
  // entrance may run while its final positions are rendered.
  for (const key of ['drag-test-1', 'drag-test-2', 'drag-test-3']) {
    const wordFrames = audit.flatMap((frame) => frame.words)
      .filter((word) => word.key === key);
    assert.ok(wordFrames.length > 0, `${key} was not audited`);
    assert.ok(
      wordFrames.every((word) => !word.target_animation_name || word.target_animation_name === 'none'),
      `${key} unexpectedly animated in the exported CPT`,
    );
    assert.ok(
      wordFrames.every((word) => Number(word.target_opacity ?? 1) === 0 || Number(word.target_opacity ?? 1) === 1),
      `${key} used partial animation opacity instead of an instant static reveal`,
    );
  }

  console.log('Dragged-word export parity checks passed')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
