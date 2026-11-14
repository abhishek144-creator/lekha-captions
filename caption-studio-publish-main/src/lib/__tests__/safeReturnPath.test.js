import { describe, expect, it } from 'vitest'
import { safeReturnPath } from '../safeReturnPath'

describe('post-login return paths', () => {
  it.each([
    'https://outside.example/path',
    '//outside.example/path',
    '/\\outside.example/path',
    '/\t/outside.example/path',
    '/\n/outside.example/path',
    'javascript:alert(1)',
    'Dashboard',
    null,
    '',
  ])('rejects an external or malformed destination: %j', (value) => {
    expect(safeReturnPath(value)).toBe('/Dashboard')
  })

  it.each([
    '/Dashboard',
    '/Dashboard?entry=editor&name=a%20b#captions',
    '/helpandsupport?topic=payment',
  ])('keeps a local path and its query and fragment: %s', (value) => {
    expect(safeReturnPath(value)).toBe(value)
  })
})
