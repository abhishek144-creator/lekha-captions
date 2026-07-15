import { legacyFunctionRetiredResponse } from './_shared/security.ts';

// Video transcription moved to the authenticated FastAPI pipeline.
Deno.serve(() => legacyFunctionRetiredResponse());
