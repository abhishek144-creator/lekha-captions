export function createLocalProjectId() {
  const crypto = globalThis.crypto
  if (typeof crypto?.randomUUID === 'function') return `local_${crypto.randomUUID()}`
  if (typeof crypto?.getRandomValues !== 'function') throw new Error('A secure browser connection is required to create a project.')
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `local_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}
