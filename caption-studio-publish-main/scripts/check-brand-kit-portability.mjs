import assert from 'node:assert/strict'
import {
  BRAND_KIT_DOCUMENT_SCHEMA,
  createBrandKitDocument,
  mergeBrandKits,
  parseBrandKitDocument,
} from '../src/components/dashboard/brandKitUtils.js'

const document = createBrandKitDocument([{
  id: 'local-only-id',
  name: 'Launch Style',
  style: {
    font_family: 'Inter',
    text_color: '#ffffff',
    position_y: 75,
    unknown_executable_field: '<script>alert(1)</script>',
  },
}])

assert.equal(document.schema, BRAND_KIT_DOCUMENT_SCHEMA)
assert.equal(document.version, 1)
assert.equal(document.brand_kits[0].style.font_family, 'Inter')
assert.equal(document.brand_kits[0].style.unknown_executable_field, undefined)

const imported = parseBrandKitDocument(JSON.stringify(document))
assert.equal(imported.length, 1)
assert.equal(imported[0].name, 'Launch Style')
assert.notEqual(imported[0].id, 'local-only-id')

const merged = mergeBrandKits([
  { id: 'old', name: 'Launch Style', style: { text_color: '#000000' } },
  { id: 'second', name: 'Second', style: { text_color: '#eeeeee' } },
], imported)
assert.equal(merged.length, 2)
assert.equal(merged[0].style.text_color, '#ffffff', 'imported kits replace same-name local kits')

assert.throws(() => parseBrandKitDocument('{bad json'), /valid JSON/)
assert.throws(() => parseBrandKitDocument(JSON.stringify({ schema: 'other', version: 1, brand_kits: [] })), /unsupported/)

console.log('Brand-kit portability checks passed.')
