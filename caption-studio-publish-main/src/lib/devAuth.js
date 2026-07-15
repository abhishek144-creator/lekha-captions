export async function getEffectiveAuthToken(currentUser) {
  // getIdToken() must be preferred: it transparently refreshes an expired
  // token. Never fall back to a cached snapshot or development token.
  let signedInToken = '';
  try {
    signedInToken = await currentUser?.getIdToken?.() || '';
  } catch {
    signedInToken = '';
  }
  return signedInToken;
}
