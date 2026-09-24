# Production release — 24 September 2026

The public website and API now report GitHub `main` release
`03f9f544125f73115b5437cf96b89b2dfd32c7a3`.

Verified after deployment:

- [Website release metadata](https://lekhacaptions.com/release.json) and
  [API version](https://api.lekhacaptions.com/api/version) report the same full
  release SHA and release version `gcp-production-03f9f54`.
- [API readiness](https://api.lekhacaptions.com/api/health/readiness) reports
  `ready: true`.
- The public website and `/Dashboard?entry=editor` return HTTP 200.

These checks establish the deployed release identity and basic availability.
They do not constitute a paid payment, transcription, or full customer media
journey test in production.

