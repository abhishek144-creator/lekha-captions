import lcMotionScheduleSource from './lcMotionSchedule.js?raw'
import sidebarSequencerSource from '../../assets/template-preview/sidebar-sequencer.js?raw'
import advancedSequencerSource from '../../assets/template-preview/advanced-sequencer.js?raw'
import basicSequencerSource from '../../assets/template-preview/basic-sequencer.js?raw'
import { toPreviewScriptText } from './templatePreviewScriptText.js'

const inlineScript = (source) => `<script>${toPreviewScriptText(source)}</script>`

export const LC_MOTION_SCHEDULE_SCRIPT = inlineScript(lcMotionScheduleSource)
export const SIDEBAR_PREVIEW_SCRIPT = inlineScript(sidebarSequencerSource)
export const ADVANCED_PREVIEW_SCRIPT = inlineScript(advancedSequencerSource)
export const BASIC_PREVIEW_SCRIPT = inlineScript(basicSequencerSource)

// Per-template values for the sequencers. A JSON data block is never executed,
// so it needs no CSP allowance; escaping "<" keeps it from closing early.
export function previewConfigScript(config) {
  const json = JSON.stringify(config).replace(/</g, '\\u003c')
  return `<script type="application/json" id="lekha-preview-config">${json}</script>`
}
