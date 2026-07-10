import { featureFlags } from '@/lib/featureFlags';

export const LOCAL_DEV_BYPASS_TOKEN = 'mock-token';

export async function getEffectiveAuthToken(currentUser) {
  // getIdToken() must be preferred: it transparently refreshes an expired
  // token. `accessToken` is a cached snapshot that goes stale after ~1 hour,
  // which made exports fail with 401 in long editing sessions.
  let signedInToken = '';
  try {
    signedInToken = await currentUser?.getIdToken?.() || '';
  } catch {
    signedInToken = '';
  }
  if (!signedInToken) signedInToken = currentUser?.accessToken || '';
  if (signedInToken) return signedInToken;
  return featureFlags.localDevAuthBypass ? LOCAL_DEV_BYPASS_TOKEN : '';
}
