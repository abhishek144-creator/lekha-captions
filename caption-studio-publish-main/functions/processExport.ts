import { legacyFunctionRetiredResponse } from './_shared/security.ts';

// Export processing moved to the authenticated FastAPI pipeline. Keeping this
// endpoint as a hard retirement prevents the legacy non-atomic credit flow from
// being reactivated by a routing or configuration change.
Deno.serve(() => legacyFunctionRetiredResponse());
