# H-2 Dry-Run Report

**Date:** 2026-09-09
**RFC:** C2-07 — Dry-Run Integration Test
**Status:** All acceptance criteria met

---

## Summary

The curation pipeline components (chunker → prompt builder → mock LLM → response parser → schema validation → fallback parser) have been tested end-to-end against both a good and bad mock transcript. All tests pass. No blocking issues found.

## Acceptance Criteria Results

| AC | Description | Result | Evidence |
|----|-------------|--------|----------|
| AC1 | Full pipeline runs without unhandled exceptions on both mock transcripts | **PASS** | `dry_run.test.js` — tests `AC1: good transcript` and `AC1: bad transcript` |
| AC2 | Good transcript produces plausible high `concept_score` with non-null `pedagogical_reason` | **PASS** | `dry_run.test.js` — test `AC2: good transcript produces high concept_score` asserts score >= 70 and reason non-empty |
| AC3 | Bad/off-topic transcript produces either a low score or a clean rejection — not a crash | **PASS** | `dry_run.test.js` — test `AC3: bad transcript produces low score` asserts score <= 40 |
| AC3b | Garbage LLM output handled gracefully | **PASS** | `dry_run.test.js` — tests `AC3b` (garbage text) and `AC3c` (partial JSON) both return success boolean without exceptions |

## Changes Made

### New Files
- `backend/tests/dry_run.test.js` — 9 tests covering all ACs + schema validation
- `backend/tests/fixtures/sample_transcript_bad_mock.json` — Bad transcript fixture (rubric Example B)
- `docs/adr/0002-injectable-llm.md` — ADR for injectable `callLlm` decision
- `docs/reports/h2_dry_run_report.md` — This report

### Modified Files
- `CONTEXT.md` — Added 4 domain terms (Dry-Run Integration Test, Mock LLM, Sample Transcript, Pipeline Components)
- `backend/src/services/curation.service.js` — Refactored: `callLlm` injectable, exported `buildPrompt` and `parseLlmResponse`

## Test Results

```
47 tests passed, 0 failed
├── 9 dry-run integration tests (new)
├── 7 chunker tests (existing)
├── 9 curation service tests (existing)
├── 6 clip output schema tests (existing)
├── 7 auth tests (existing)
├── 6 app/middleware tests (existing)
├── 2 database config tests (existing)
└── 1 health route test (existing)
```

## Open Issues for H-3

1. **Mock LLM fidelity** — The mock LLM returns hardcoded segments. When the real LLM is integrated at H-3, the prompt may need tuning based on actual LLM output patterns. The report should be re-evaluated after live integration.

2. **Prompt exported for testing** — `buildPrompt` is now exported from `curation.service.js`. This is acceptable for testability but means prompt construction is part of the module's public API. Consider whether prompt changes should be versioned.

3. **`callLlm` stub behavior** — The default `callLlm` returns `{segments: []}`. This means `curateClips()` in production will always find 0 clips and throw `"hanya 0 klip ditemukan"`. This is expected until the real LLM is wired in, but should be documented as a known state.

4. **Bad transcript fixture coverage** — The bad transcript fixture matches rubric Example B (off-topic, mid-sentence cutoff). Additional edge cases (e.g., valid structure but low elaboration score) could be added but are not required for H-2.

5. **Schema alignment** — Both `clipOutputSchema` and `fallbackOutputSchema` correctly enforce the 25-75 second duration constraint and 0-98 concept_score range per ADR-0001. No drift detected.

## Verification Commands

```bash
# Run dry-run tests only
node --test backend/tests/dry_run.test.js

# Run all backend tests
node --test backend/tests/*.test.js
```
