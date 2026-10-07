# ASS versus DOM renderer benchmark

`scripts/benchmark_renderers.py` is the repeatable export-performance harness.
It runs the production `VideoProcessor` ASS and browser DOM/CSS paths against:

- one generated source MP4 and its recorded SHA-256;
- one caption timeline with identical text and timings;
- the same duration, export quality, frame rate, aspect ratio, encoder setting,
  and CPU preset; and
- balanced execution order, with warmup runs excluded from the summary.

The visual styles intentionally differ only by a supported bounded text-box
layout, because that rich layout selects DOM/CSS while the plain caption selects
ASS. This benchmark measures the real cost of those two supported workload
classes; it does not claim that the outputs are pixel-identical.

## Run it

Install the locked backend and frontend dependencies first. The DOM path needs
Node.js, the repository's Puppeteer installation, and its Chromium binary. Both
paths need FFmpeg and FFprobe.

```powershell
npm run benchmark:renderers -- --duration 10 --repeats 5 --warmups 1 --quality 720p --fps 30
```

By default the result is written to
`build/benchmarks/renderer-benchmark.json`. The artifact contains every warmup
and measured attempt, failures, output sizes, median and P95 latency, median
real-time factor, environment versions, Git revision, fixture details, and the
DOM-to-ASS median duration ratio. Generated media and results are ignored by
Git so measured evidence is not confused with source-controlled claims.

Use an explicit threshold only after the same workload has established a
release baseline:

```powershell
npm run benchmark:renderers -- --repeats 5 --max-dom-to-ass-ratio 4
```

The command exits nonzero if either renderer has a failed measured run or if
the optional ratio threshold is exceeded. `--keep-outputs` preserves the source
and rendered MP4s beside the JSON for visual inspection.

## Release evidence

Run the benchmark on the actual worker image and machine type before changing
worker CPU/memory, encoder, Chromium, FFmpeg, render code, or autoscaling work
ratios. Compare only artifacts with the same fixture settings. Keep the JSON in
the release evidence store and use successful-export billing reconciliation for
cost decisions; elapsed time alone is not infrastructure cost.

This local harness proves that the comparison is executable and repeatable. It
does not replace staged burst tests at 10/25/50/100 concurrent exports.

## Railway comparison measured — 2026-10-06

The completed 60-second 1080p/30 FPS comparison used one warmup and five
measurements per renderer on each CPU limit. Actual cgroups verified four/eight
vCPUs and an 8,000,000,000-byte memory limit (about 7.45 GiB); the requested
Railway configuration was 8 GiB. Both runs used the same fixture SHA-256,
Node 22.23.3, FFmpeg 5.1.9 and identical renderer/fixture-generator source.
The completed four-CPU run used `0c5182f`; eight CPUs used `6d5dccd`.

| Replica | ASS median / P95 | DOM bounded text box median / P95 | Measured successes per path |
|---|---:|---:|---:|
| 4 vCPU | 20.866 / 22.754 s | 33.188 / 34.554 s | 5/5 |
| 8 vCPU | 8.985 / 9.227 s | 15.646 / 16.127 s | 5/5 |

Median speedups were 2.32× for ASS and 2.12× for DOM. An earlier four-CPU
attempt was interrupted by platform sleep; it is not counted as a completed
comparison. The owner approved twelve additional bounded renders.

The DOM workload is a bounded text box. A paired representative authored
animated-template benchmark remains unmeasured. Keep DOM work ratio 3 and ASS
work ratio 1; these baseline numbers do not justify cheaper admission for every
template.

See the [acceptance report](LAUNCH_ACCEPTANCE_2026-10-06.md#cpu-comparison) and
[redacted measurements](evidence/railway-b4-20261006.json), including all warmup
and measured attempts, runtime quotas, fixture hash and source-artifact hashes.
The [staging runbook](RAILWAY_DEPLOYMENT.md#staging-measurement-runbook-2026-10-05)
describes reproduction; its expired staging approval is not permission to
recreate paid resources.
