# Grilling Session: Batch 4 — Cross-Template Validation

**Date:** 2026-09-13
**RFC:** h_4_batch_3_cross_template_validation.md
**Skills used:** grilling, domain-modeling

---

## Session Summary

A grilling session to stress-test RFC-C4-05 (Cross-Template Validation Pass) against the existing Cuplik render pipeline. All decisions were resolved through Socratic questioning before implementation. The session produced 4 contract addenda and 1 contract correction that refined the RFC's scope and acceptance criteria.

---

## Decisions Resolved

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Test framework | `node:test` / `node:assert/strict` | Matches existing convention in `reframe-templates.test.js`; no Jest migration |
| 2 | ffprobe helper location | `backend/src/utils/ffprobeUtils.js` | Shared utility, not test-scoped — report generator is a non-test caller |
| 3 | ffprobe return shape | `{ width, height, codec, container, duration }` | Flat object matching the four dimensions C4-05 checks; no speculative fields |
| 4 | Report generator location | `backend/scripts/generateValidationReport.js` | One-off tool, not part of the test suite; `backend/scripts/` already exists |
| 5 | Report output | `docs/rfc/C4-05/template_validation_report.md` | Co-located with the RFC it serves |
| 6 | Timing drift check | ffprobe duration vs `(endTime - startTime)` within ±0.1s | Frame-rate rounding causes legitimate near-zero drift; ±0.1s absorbs this |
| 7 | Safe-zone flag | Against actual current code (bottom-band = real conflict risk), PROVISIONAL | Current stacked implementation carries real overlap with TikTok/Reels UI |
| 8 | Template A PiP rework | Out of scope for C4-05 | C4-05 validates output properties, not internal compositing logic |
| 9 | Where assertions go | Extend existing `reframe-templates.test.js` | Runs on every `npm test`, not just during C4-05 |

---

## Contract Addenda

### Addendum 1: Validation Report Generation

- Cross-template consistency checks are ffprobe-based, programmatic — no human reading raw FFmpeg output
- Assertions go into `reframe-templates.test.js` using `node:test`/`node:assert/strict`
- ffprobe logic extracted into shared helper (`ffprobeUtils.js`) to avoid duplication
- Separate report generator script (`generateValidationReport.js`) runs on demand, not on CI
- Only the subtitle safe-zone flag paragraph is manually written

### Addendum 2: ffprobeUtils.js Return Shape

- Returns `{ width, height, codec, container, duration }` — flat, no raw JSON
- Extraction logic lives once inside `ffprobeUtils.js`; callers never parse raw ffprobe output
- Future callers needing new fields extend the structured object, not drop to raw JSON

### Addendum 3: Safe-Zone Readiness Statement

- H-5 is NOT blocked. The constraint IS the readiness statement
- Report states: "H-5 may proceed with subtitle placement now, under one constraint: avoid the bottom 30%"
- Constraint is TEMPORARY — to be re-validated once C4-02's PiP rework ships
- When PiP lands, the safe-zone section must be explicitly updated

### Addendum 4: Report Generator Location

- `backend/scripts/` — new directory, signals "one-off tool, not part of the test suite"
- Not co-located with tests since the report generator is explicitly NOT a test file

---

## Contract Corrections

### Correction 1: Node:test Framework (Q3)

The addendum's "Jest assertions" was imprecise wording. Corrected to `node:test`/`node:assert/strict`, matching the existing convention. No framework migration.

### Correction 2: Timing Drift Scope (Q4)

"Does the trimmed output actually start/end where requested" overstated the check. ffprobe reports output file metadata only — it cannot verify frame content against the source. The check is: output duration via ffprobe matches `(endTime - startTime)` within ±0.1s. Drift exceeding tolerance is a real signal (e.g., trim applied input-side by mistake).

### Correction 3: Template A PiP Scope (Q6)

C4-05's objective checks (resolution, codec, timing) are NOT blocked by the Template A PiP rework. They test output file properties, independent of internal compositing logic. The PiP rework is a follow-up correction to C4-02, tracked separately.

### Correction 4: Safe-Zone Finding vs. Actual Code (Q6 addendum)

The original safe-zone finding described the DECIDED PiP model, not the CURRENT shipped stacked-band implementation. Corrected to: as shipped, Template A places the camera in a bottom band — this DOES carry real conflict risk. Report must state findings against actual current code, marked PROVISIONAL.

---

## Key Questions & Answers

### Q1: What does "not standalone" mean in the RFC?

The RFC says "run through the shared `reframeCommon.js` wrapper (not standalone)." The render contract already states workers call `renderClip()`, not templates directly. "Not standalone" confirms: validation runs through the single public entry point, not by calling template files individually. No gap in the existing contract.

### Q2: Is the deliverable a test script or manual report?

**Answer:** Automated. ffprobe-based assertions in `node:test`, plus a separate report generator script. No human reading raw FFmpeg output.

### Q3: Jest or node:test?

**Answer:** `node:test`/`node:assert/strict`. The "Jest" wording was imprecise.

### Q4: What does timing drift actually measure?

**Answer:** Output duration via ffprobe vs. requested duration `(endTime - startTime)`, within ±0.1s. Not frame-level source comparison (ffprobe can't do that). Frame-rate rounding causes legitimate near-zero drift.

### Q5: What does the safe-zone flag actually check?

**Answer:** Template A's bottom camera band (30% of canvas) overlaps TikTok/Reels interaction icons. Real conflict risk. Constraint forward to H-5: avoid bottom 30%.

### Q6: Is Template A's PiP rework a blocker?

**Answer:** No. C4-05 validates output properties, not compositing logic. PiP rework is separate.

### Q7: Where does ffprobeUtils.js live?

**Answer:** `backend/src/utils/` — shared utility, not test-scoped.

### Q8: Where does the report generator live?

**Answer:** `backend/scripts/` — one-off tool, not part of the test suite.

### Q9: What shape does ffprobeUtils return?

**Answer:** `{ width, height, codec, container, duration }` — flat, no raw JSON.

---

## Files Created/Changed

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/utils/ffprobeUtils.js` | Created | Shared ffprobe utility |
| `backend/tests/reframe-templates.test.js` | Edited | Added cross-template consistency assertions |
| `backend/scripts/generateValidationReport.js` | Created | One-off report generator |
| `docs/rfc/C4-05/template_validation_report.md` | Generated | C4-05 deliverable |

---

## Verification

- 8/8 tests pass (smoke tests + cross-template consistency)
- Report generator produces correct output with code-verified 30% figure
- All three acceptance criteria satisfied:
  1. Spec-consistent output via shared wrapper ✓
  2. Timing drift quantified (0.012s) ✓
  3. Report explicitly states H-5 readiness with constraint ✓

---

## Known Limitations

1. **Safe-zone is PROVISIONAL** — applies to current stacked implementation only. Must be re-validated after PiP rework.
2. **PiP rework is out of scope** — C4-05 validates, does not implement. Tracked as separate follow-up to C4-02.
3. **Container format reported as full ffprobe string** — `mov,mp4,m4a,3gp,3g2,mj2` is ffprobe's `format_name` for MP4. The check asserts all three templates produce the same value, not that it equals a specific string.
