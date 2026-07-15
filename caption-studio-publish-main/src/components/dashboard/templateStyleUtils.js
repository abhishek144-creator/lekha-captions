export function readCssDeclaration(body = '', property = '') {
  if (!property) return ''
  const escapedProperty = String(property).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(body).match(new RegExp(`(?:^|;)\\s*${escapedProperty}\\s*:\\s*([^;]+)`, 'i'))
  return match?.[1]?.trim() || ''
}
