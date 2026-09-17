# Chunking Decision: RFC-C2-04

## Decision

**Chosen approach: Fixed chunks with context padding.**

Not sliding window with overlap. Not map-reduce.

## Rationale

| Approach | Pros | Cons |
|---|---|---|
| Sliding window with overlap | No concept loss at boundaries | Redundant LLM calls, higher token cost, de-duplication needed |
| Map-reduce | Parallel scoring, global re-ranking | Complex, two-pass, overkill for MVP |
| **Fixed chunks + context padding** | Non-overlapping scored segments, no redundant calls, simple, configurable | Risk of concept cut at boundary (mitigated by context padding) |

Fixed chunks with context padding gives the best balance:
- Each word appears in exactly one scored range (no de-duplication needed)
- Context padding provides surrounding words for concept boundary judgment
- Simple to implement, test, and reason about
- Configurable chunk size allows tuning after real benchmarks

## Expected chunk count (45-min video)

| Chunk duration | Chunks for 45 min | Context padding | Total tokens per chunk (est.) |
|---|---|---|---|
| 5 min (300s) | 9 | ±30s | ~1,040 |
| 10 min (600s) | 5 | ±30s | ~2,080 |
| 15 min (900s) | 3 | ±30s | ~3,120 |

Token estimate assumes ~200 words/min speaking rate, ~1.3 tokens/word (Indonesian/English mix).

## NFR-1 budget

NFR-1 requires total processing < 15 min for 45-min video. The chunking strategy is configurable — real benchmarking at H-07 will determine optimal chunk size. Default 5-min chunks produce 9 LLM calls; if each call takes ~30s, curation takes ~4.5 min, well within budget.

## Why not map-reduce (approach B)

Map-reduce was rejected for MVP because:
1. It requires a second pass to re-rank/merge global candidates
2. The re-ranking logic adds complexity without clear benefit for 3-5 clip selection
3. Fixed chunks with context padding already provides sufficient context for concept scoring
4. If needed later, map-reduce can be added as an optimization without changing the chunker interface

The re-ranking step is **not stubbed** because approach B was not chosen (per RFC-C2-04 AC3, this is acceptable).
