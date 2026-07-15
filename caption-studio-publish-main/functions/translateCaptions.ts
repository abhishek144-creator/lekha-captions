import { legacyFunctionRetiredResponse } from './_shared/security.ts';

// Caption translation moved to the authenticated FastAPI pipeline.
Deno.serve(() => legacyFunctionRetiredResponse());
