import { featureFlags } from '@/lib/featureFlags';

export const LOCAL_DEV_BYPASS_TOKEN = 'mock-token';

export async function getEffectiveAuthToken(currentUser) {
  const signedInToken = currentUser?.accessToken || await currentUser?.getIdToken?.() || '';
  if (signedInToken) return signedInToken;
  return featureFlags.localDevAuthBypass ? LOCAL_DEV_BYPASS_TOKEN : '';
}
