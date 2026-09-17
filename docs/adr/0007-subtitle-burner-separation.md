# Subtitle Burner as Separate FFmpeg Pass

The subtitle burner takes the already-reframed `vertical.mp4` as input and produces a separate `subtitled.mp4`, rather than chaining subtitle filters into the existing `renderClip()` reframe pipeline.

This preserves the raw vertical render for re-rendering with different subtitle styles without re-running the expensive reframe pass. The two FFmpeg invocations (reframe + subtitle burn) are independent, stateless, and testable in isolation.

Considered chaining subtitle burning into `renderClip()` to save one FFmpeg pass. Rejected because: (1) subtitle style changes would require re-running the full reframe, (2) the two concerns have different inputs and different test surfaces, (3) the extra pass is fast (subtitle burn is ~5-10s on a 60s clip) compared to reframe (~30-60s).

## Deviation: `manual_review_required` dropped

The RFC (H-5 Batch 1) specifies a `manual_review_required` boolean that short-circuits burning when ASR WER > 25%. Dropped because: (1) WER computation requires a reference transcript — not available at runtime for arbitrary webinar uploads, (2) no WER calculation code exists in the codebase, (3) the FRD's "Day-1 Gate Check" reads as a development-time benchmarking step, not a runtime feature. Per-word `confidence` scores from the ASR provider are the available runtime quality signal. If a quality gate is needed later, threshold on average confidence, not WER.
