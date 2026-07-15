import { legacyFunctionRetiredResponse } from './_shared/security.ts';

// Credits are authoritative in Firestore through the FastAPI transaction path.
Deno.serve(() => legacyFunctionRetiredResponse());
