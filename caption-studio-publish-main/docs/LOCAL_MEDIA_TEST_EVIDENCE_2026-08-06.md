# Local Media Test Evidence — 2026-08-06

This is regression evidence for the user-provided `IMG_4695.MOV`. It does not
replace the required authenticated Railway staging media-flow drill.

- Source: 11.168-second MOV, H.264 video, AAC audio, 1920×1080 metadata with
  rotation, SHA-256 `4C6B470006F0FDA4878AAEB67D5CDF3A7E304E8D7895173FD3BD16C1374D75E8`.
- Environment: local development API with the explicit development auth bypass;
  no production security control was changed.
- Upload: PASS; file ID `6be5b1d9-22f4-4e82-bd3b-75b55ad0ddac`.
- English transcription: PASS; seven caption groups with word timestamps.
- Export: PASS; job `edab2187-96df-4a5a-91ee-46435a5c171a`, 1080×1920,
  30 fps, H.264/AAC, 10,876,108 bytes.
- Download validation: PASS; MP4 signature and payload size validated.
- Export SHA-256:
  `D839CBFCCB706A12A109649787C75FB0DDCC03CDF6DC3916147E7945CF67524C`.

The generated text still needs normal human review: the outdoor speech produced
several imperfect phrases. This is expected accuracy-limit evidence, not a
polished public product demonstration.

## Remaining staging blocker

Railway staging remains fail-closed because the malware-scanner service cannot
run within the current approximately 1 GiB memory limit. Do not mark the
authenticated staging media flow complete until a private scanner with adequate
memory (or an approved external scanner) is running and the same flow passes.
