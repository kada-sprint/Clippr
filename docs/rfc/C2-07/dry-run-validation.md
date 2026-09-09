## BATCH 4 — Validation

### RFC-C2-07: Dry-Run Integration Test

**Status:** Implemented
**Depends on:** C2-01 (transcript schema), C2-02 (scoring rubric), C2-04 (chunking), C2-05 (output schemas), C2-06 (fallback parser)
**Objective:** Confirm the full chain — chunker → prompt builder → (mock) LLM call → schema validation → fallback-on-failure — works end-to-end on at least one realistic transcript before H-3's live API integration.

**Specification:**

* Wire together pipeline components using injectable `callLlm` (see ADR-0002): `chunker.js` → `buildPrompt()` → mock LLM → `parseLlmResponse()` → `clipOutputSchema` / `fallbackOutputSchema`.

* Run against `docs/rfc/C2-01/sample_transcript_mock.json` end-to-end.

* Also run against one deliberately "bad" mock transcript (`backend/tests/fixtures/sample_transcript_bad_mock.json`, based on rubric Example B from C2-02) to confirm low `concept_score` output or correct rejection, rather than the pipeline crashing or scoring it artificially high.

* Also run against garbage and partial JSON LLM output to confirm fallback parser handles gracefully.

**Deliverable:** `backend/tests/dry_run.test.js` + `docs/reports/h2_dry_run_report.md` documenting what passed, what didn't, and any schema/prompt tweaks made as a result.

**Acceptance Criteria:**

* [x] Full pipeline runs without unhandled exceptions on both mock transcripts

* [x] Good transcript produces a plausible high `concept_score` with non-null `pedagogical_reason`

* [x] Bad/off-topic transcript produces either a low score or a clean rejection — not a crash

* [x] Report documents any open issues to carry into H-3 (e.g., "mock LLM returns hardcoded segments — re-evaluate after live integration")

**Run command:**

```bash
node --test backend/tests/dry_run.test.js
```
