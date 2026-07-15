import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  BASIC_TEMPLATE_STYLES,
  getBasicTemplateExportEffects,
  getBasicTemplateStyle,
  marksTemplateColorCustomized,
} from '../src/components/dashboard/basicTemplateCatalog.js'
import { readCssDeclaration } from '../src/components/dashboard/templateStyleUtils.js'

assert.equal(Object.keys(BASIC_TEMPLATE_STYLES).length, 29)
assert.equal(getBasicTemplateStyle('t-109').shadow_blur, 0)
assert.deepEqual(getBasicTemplateExportEffects('t-104'), {
  has_background: false,
  has_stroke: true,
  has_shadow: false,
  stroke_color: '#2563EB',
  stroke_width: 2,
})
assert.equal(getBasicTemplateExportEffects('unknown').has_shadow, undefined)
assert.equal(marksTemplateColorCustomized({ show_inactive: false }), false)
assert.equal(marksTemplateColorCustomized({ highlight_color: '#ffffff' }), true)
assert.equal(readCssDeclaration('background-color: #000; color: #fff; border-color: red', 'color'), '#fff')
assert.equal(readCssDeclaration('font-size: 20px; font-family: Inter', 'font-family'), 'Inter')

const templatesTabSource = fs.readFileSync(new URL('../src/components/dashboard/TemplatesTab.jsx', import.meta.url), 'utf8')
const advancedSource = fs.readFileSync(new URL('../src/components/dashboard/AdvancedTemplateLibrary.jsx', import.meta.url), 'utf8')
const exportSource = fs.readFileSync(new URL('../src/components/dashboard/ExportPanel.jsx', import.meta.url), 'utf8')
assert.equal(/style:\s*\{\s*template_id:/.test(templatesTabSource), false)
assert.equal(advancedSource.includes('const BASIC_TEMPLATE_STYLE ='), false)
assert.equal(exportSource.includes('TEMPLATE_CANONICAL_STYLES'), false)

console.log('Basic template catalog checks passed')
