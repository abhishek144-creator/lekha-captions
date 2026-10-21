// Template-card previews run in sandboxed srcdoc frames, which inherit the
// page CSP. Their scripts are allowed by hash, so the text placed in each
// <script> must be exactly what scripts/check-release-readiness.mjs hashes.
export const TEMPLATE_PREVIEW_SCRIPT_FILES = [
  'src/components/dashboard/lcMotionSchedule.js',
  'src/assets/template-preview/sidebar-sequencer.js',
  'src/assets/template-preview/advanced-sequencer.js',
  'src/assets/template-preview/basic-sequencer.js',
]

// LF line endings (what the HTML parser hands the hash check) and no module
// syntax, so a shared ES module can also run as a classic script.
export function toPreviewScriptText(source) {
  return String(source).replace(/\r\n?/g, '\n').replace(/^export /gm, '')
}
