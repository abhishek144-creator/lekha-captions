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
