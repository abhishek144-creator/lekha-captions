// URL parsers treat a backslash like a slash in HTTP URLs. A leading slash
// alone therefore cannot establish that a post-login destination is local.
export function safeReturnPath(value, fallback = '/Dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const base = 'https://return-path.invalid'
    return new URL(value, base).origin === base ? value : fallback
  } catch {
    return fallback
  }
}
