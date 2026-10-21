const publicPaths = new Map([
  ['/', '/'], ['/home', '/'], ['/homev2', '/homev2'], ['/login', '/login'],
  ...['faq', 'helpandsupport', 'termsandconditions', 'privacypolicy', 'refundpolicy',
    'acceptableusepolicy', 'knownlimitations', 'changelog', 'status'].map(path => [`/${path}`, `/${path}`]),
])

export function canonicalPublicPath(pathname) {
  return publicPaths.get(pathname.toLowerCase().replace(/\/+$/, '') || '/') || null
}
