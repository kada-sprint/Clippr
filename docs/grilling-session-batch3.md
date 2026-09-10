# Grilling Session: Batch 3 — Benchmark & Ship

**Date:** 2026-09-10
**RFC:** h_3_batch_3_benchmark_ship.md
**Skills used:** grilling, domain-modeling

---

## Session Summary

A grilling session to stress-test RFC-C3-05 (Latency & Cost Benchmarking) and RFC-C3-06 (Single Callable Curation Module) against the existing Cuplik codebase. All decisions were resolved through Socratic questioning before implementation.

---

## Decisions Resolved

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Module signature | Coupled to `projectId` + Prisma | Aligns with existing `curateClips`, reduces caller complexity |
| 2 | Post-curation filtering | Adaptive Top-N — no quality gate | User's biggest fear: returning too few clips |
| 3 | `concept_score` in return | Raw integer 0–98 | Normalization is DB-only concern; dedup needs raw value |
| 4 | Time fields naming | Prisma convention (`startTime`, `endTime`) | Matches DB shape, snake_case stays only in LLM contract |
| 5 | Error handling | Throw if < 3 clips after dedup | Legitimate failure — LLM found almost nothing |
| 6 | Benchmark approach | Actual API calls with existing excerpts | Real numbers, not estimates |

---

## Key Questions & Answers

### Q: Should the module be a pure function or coupled to Prisma?
**A:** Keep it coupled. The `insertClips` and `prisma.llmCall.create` logging stay inside the module. Caller doesn't need to wire persistence.

### Q: How to handle low-quality segments — re-prompt or post-filter?
**A:** Neither. Adaptive Top-N — sort by score, take top 5, no quality gate. On normal webinar input (9 chunks × 1-3 segments each), you'll always have enough clips after dedup.

### Q: Should the return type use normalized or raw concept score?
**A:** Raw integer 0–98. The normalized 0.0–1.0 is only for DB storage. Everything else (prompt, rubric, dedup ranking) operates on the raw value.

### Q: Should time fields be snake_case or Prisma convention?
**A:** Prisma convention (`startTime`, `endTime`) in the return type. Snake_case stays in LLM contract (prompt, Joi schemas).

### Q: Can we estimate token cost from excerpt data?
**A:** Yes, with actual API calls. Run 3 existing excerpts through `buildPrompt` → `callChatCompletion`, capture `response.usage`, project to 9 chunks.

### Q: What if post-filtering returns too few clips?
**A:** Option 4 (Adaptive Top-N) always returns clips for non-empty transcripts. Only fails if LLM finds < 3 segments across all chunks — a real pipeline failure.

### Q: Should we add error-path separation to the return type?
**A:** No. Adaptive Top-N means nothing is "rejected" — clips are just ranked and top-N returned. Error-path separation is unnecessary.

### Q: Where should the curation README live?
**A:** `backend/README_curation.md` — more discoverable for someone working in the backend directory.

---

## Grilling Trace

### Topic 1: Module Interface

```
Q: Pure function vs Prisma-coupled?
  → User: "keep it like it is now" (coupled)
  → Decision 1 locked

Q: What's the return type shape?
  → Explored: Prisma-only, snake_case-only, or both
  → User: "back to concept score normalization, which one closer that keeps the prd objectives"
  → Analysis: PRD REQ-3.3 shows normalized 0.88, but ADR-0001 says normalization is DB-only
  → User: "the normalization is only to be passed to be db"
  → Decision 3 locked: raw integer 0–98

Q: Time fields — snake_case or Prisma?
  → User: "what are other fields affected"
  → Analysis: 51 matches for start_time_seconds, 50 for end_time_seconds
  → User: "1" (keep snake_case)
  → Later revised to Prisma convention after understanding dedup logic
```

### Topic 2: Quality Fallback

```
Q: Re-prompts or post-curation filtering?
  → Analysis: Re-prompts blow the NFR-1 budget (~7-13 min worst case)
  → User: "what if we do the post-curation"
  → Explored: fixed threshold, configurable, dynamic, adaptive
  → User: "33" (option 3: dynamic top-N with soft floor)
  → User: "1" (biggest fear: returning too few clips)
  → Decision 2 locked: Adaptive Top-N, no quality gate
```

### Topic 3: Benchmarking

```
Q: Token cost vs latency concern?
  → User: "yes token cost is a concern"
  → Analysis: C3-03 E2E test doesn't capture tokens
  → User: "can we estimate using excerpt data?"
  → Analysis: Yes, with API calls
  → User: "let's do option A for now"
  → User: "include the actual api calls"
```

---

## Implementation Results

### RFC-C3-05: Token Cost Benchmark

**Result: $0.0066 per 45-minute video**

| Metric | Value |
|--------|-------|
| Avg input tokens/chunk | 2,023 |
| Avg output tokens/chunk | 277 |
| Avg latency/chunk | 5,313ms |
| Chunks for 45-min video | 9 |
| Total input cost | $0.0036 |
| Total output cost | $0.0030 |
| **Total per video** | **$0.0066** |

**Verdict:** Within acceptable cost range (less than $0.10/video)

### RFC-C3-06: Module Interface

**Changes made:**
- `computeOverlap` / `isContained` → uses `startTime` / `endTime`
- `insertClips` → drops snake_case duplicates, keeps raw `concept_score`
- Tests updated to Prisma field names
- README created at `backend/README_curation.md`
- ADR-0003 created at `docs/adr/0003-curation-module-interface.md`

### Verification

- 30/30 tests pass — no regressions

---

## Files Created/Changed

| File | Action | Purpose |
|------|--------|---------|
| `docs/rfc/C3-05/benchmark_token_cost.js` | Created | Benchmark script with real API calls |
| `docs/rfc/C3-05/benchmark_report.md` | Created | Generated benchmark report |
| `backend/src/services/curation.service.js` | Edited | Clean return type, dedup uses Prisma fields |
| `backend/tests/curation.service.test.js` | Edited | Fixtures updated to Prisma field names |
| `backend/README_curation.md` | Created | Usage guide for Orang A/B |
| `docs/adr/0003-curation-module-interface.md` | Created | ADR for module interface decision |
| `CONTEXT.md` | Edited | Added Token Cost Projection + Adaptive Top-N terms |

---

## Known Limitations

1. **Benchmark is approximate** — excerpts are ~40s, real chunks are 5min. Projection assumes linear token scaling. Full multi-chunk testing needed for RFC compliance.
2. **No error-path separation** — RFC-C3-06 originally required a separate rejected list. Skipped because Adaptive Top-N returns all clips without quality filtering.
3. **LLM contract stays snake_case** — prompt examples and Joi schemas use `start_time_seconds`/`end_time_seconds`. Only the module's return type uses Prisma convention.
