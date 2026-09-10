# Curation Token Cost Benchmark

**Date:** 2026-09-10
**Model:** gpt-5.6-luna
**Pricing:** $0.2/1M input, $1.2/1M output

## Per-Chunk Results

| Excerpt | Input Tokens | Output Tokens | Latency (ms) |
|---------|-------------|---------------|--------------|
| Excerpt 1 | 2072 | 264 | 6723 |
| Excerpt 2 | 1810 | 270 | 5028 |
| Excerpt 3 | 2187 | 298 | 4189 |

## 45-Minute Video Projection

- **Chunks:** 9
- **Avg input tokens per chunk:** 2023
- **Avg output tokens per chunk:** 277
- **Avg latency per chunk:** 5313ms
- **Total estimated input tokens:** 18207
- **Total estimated output tokens:** 2496

### Cost Breakdown

| Component | Tokens | Cost |
|-----------|--------|------|
| Input | 18207 | $0.0036 |
| Output | 2496 | $0.0030 |
| **Total** | | **$0.0066** |

## Verdict

- [x] **Within acceptable cost range** — less than $0.10 per video

## Caveats

- Excerpts are ~40 seconds; real chunks are 5 minutes. Projection assumes linear token scaling.
- Real multi-chunk testing needed for full RFC-C3-05 compliance.
- Token counts may vary with transcript length due to prompt formatting.