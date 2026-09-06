# Auto-direct feasibility — 6 September 2026

Verdict: **prototype after launch blockers are addressed**. The canonical caption/template renderer can support constrained direction suggestions, but there is no verified production Auto-direct system. Introducing an LLM to the render path now would add cost, latency and nondeterminism while durable transcription/project recovery is incomplete.

## Contract and adapter

Use a versioned provider-neutral request containing language, ordered caption IDs, canonical word IDs/timings, video aspect and an allowed template/style vocabulary. Limit transcript length and treat every word as untrusted data. The model must never receive credentials, signed media URLs or permission to fetch remote resources. Sending captions to a new provider requires updating the processing inventory and user-facing data handling terms.

An illustrative response envelope is `{schema_version: 1, caption_revision: 12, directives: [...]}`. Each directive identifies an existing caption/word and allowlisted template ID with bounded emphasis/style values. This is a **proposed schema**, not an existing API. Use the repository's canonical template catalog and renderer-validated per-word fields when implementing; do not invent unsupported field names in export payloads.

Validate structure, unknown keys, numeric bounds, total directives, ID ownership and source revision before accepting a response. Do not allow model-provided CSS, JavaScript, HTML, URLs, font downloads, filesystem paths, FFmpeg filters or commands. Line breaks/layout changes must use a supported canonical editor representation; reject unsupported operations rather than silently approximating them. Model timing changes cannot reorder/overlap words beyond established constraints.

The provider adapter should expose `suggest(request, signal)` with a bounded timeout, cancellation, rate/cost budget, schema validation and at most a bounded retry for transient transport errors. Cache only within the authorized project using transcript revision + template vocabulary + prompt/provider version. Cancellation must not restart work. Preserve the manual editor state when unavailable, invalid, stale or over budget; the customer can preview and apply a diff explicitly.

## Evaluation before shipping

Use deterministic fixture transcripts spanning English, Hindi, Bengali, Gujarati, Marathi, Punjabi, Tamil, Telugu, Kannada, Malayalam, Urdu and mixed scripts. Cover punctuation, emoji, right-to-left text, long words, short/empty captions, fast speech and injected instructions in transcript text. Score schema success, unsupported directives, edit preservation, readability, pacing, preview/export parity, latency and cost. Require zero execution-capable output to reach the renderer and preserve the source caption revision on every failure.

Run production renderer comparisons for accepted directives, user override/undo tests, stale revision conflicts, provider timeout/429/5xx, malicious output, duplicate request and cancelled operation. Keep a kill switch and a deterministic manual fallback. No provider integration, spend benchmark or end-user quality experiment was executed during this audit.
