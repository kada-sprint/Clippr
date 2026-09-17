# Grilling Session: Batch 3 — Web Editor Ringan

**Date:** 2026-09-13
**RFC:** cuplik_h_5_batch_3_web_editor.md
**Skills used:** grill-with-docs, domain-modeling

---

## Session Summary

A grilling session to stress-test RFC H5 Batch 3 (Web Editor Ringan — Nudge Stepper + Inline Subtitle Editor) against the existing Cuplik codebase. All 10 decisions were resolved through Socratic questioning before implementation. The RFC was checked against PRD, FRD, API contract, and existing code at every step.

---

## Decisions Resolved

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Save + Render architecture | Two-step: `PATCH` (save) + `POST /render` (trigger) | Matches API contract and FRD's "menghubungkan penyimpanan edit ke job render ulang" |
| 2 | Transcript access | Separate `GET /clips/{id}/transcript` endpoint | Current `clipSelect` doesn't include `transcriptJson`. Separate endpoint avoids bloating 5s polling with heavy transcript data |
| 3 | 25–75s enforcement | Frontend-only for editor nudge | FRD's backend validation only applies to curation pipeline output, not user edits |
| 4 | manual_review_required flag | Ignore — doesn't exist | ADR-0007 already dropped it. No schema column, no runtime flag |
| 5 | Render endpoint params | No params — reads from DB | FRD: "Worker memakai pilihan tersimpan saat render/render ulang" |
| 6 | Render endpoint status | Implement in this batch | Owner (C) owns both editor and endpoint. No cross-team dependency |
| 7 | Subtitle style selection | Include in this batch | FRD expects it. CSS and API contract already drafted |
| 8 | Unsaved changes navigation | Confirmation dialog | Prevents accidental data loss. CSS had no modal styles — added new UI |
| 9 | BullMQ integration | Defer to H-08, use `setImmediate` for MVP | Foundation not set up at H-02. Swap is one-line change. Coordination agreement requires A/B involvement |
| 10 | Route mounting | New `clip-edit.routes.js` mounted at `/api` | Existing routes at `/api/projects` for project-scoped. Clip-level routes need `/api/clips/:clipId` |

---

## Key Questions & Answers

### Q1: "Save" — one endpoint or two?
**A:** Two-step (Option B). The RFC proposed a combined `POST /clips/{id}/rerender` but the API contract defines separate `PATCH /clips/{id}` and `POST /clips/{id}/render`. The PRD says "Editor ringan (nudge time + text edit)" — the editor is for editing, render is a consequence. FRD says "menghubungkan penyimpanan edit ke job render ulang" — connection, not identity.

### Q2: What exactly is mutable in `transcript_json`?
**A:** The `word` field only. Timestamps preserved from ASR. FRD: "penyuntingan subtitle kata demi kata dan timestamp kustom pasca-edit." Editor sends entire `transcript_json` array with corrected words. Separate `GET /clips/{id}/transcript` endpoint for fetching (avoids bloating poll responses).

### Q3: Nudge stepper — enforcement layer?
**A:** Frontend-only. The FRD says "Backend wajib memvalidasi... 3–5 hasil kurasi masing-masing 25–75 detik" — this applies to curation output, not user edits via editor.

### Q4: `manual_review_required` — where does this flag live?
**A:** Ignore. ADR-0007 already dropped it: (1) WER computation requires reference transcript not available at runtime, (2) no WER code exists, (3) FRD's "Day-1 Gate Check" is development-time benchmarking, not runtime feature. Per-word `confidence` scores are the available runtime signal.

### Q5: Render endpoint — no params?
**A:** Yes, no params. `POST /clips/{id}/render` with empty body. Server reads layout, subtitleStyle, timing, transcript from DB. Matches FRD: "Worker memakai pilihan tersimpan."

### Q6: Render endpoint — stub or real?
**A:** Real. Owner (C) owns both editor and endpoint. No cross-team dependency. Implement in this batch. The RFC's "stub the call" was pragmatic but the PRD expects them together at H-06.

### Q7: Subtitle style — in scope?
**A:** Yes. FRD mentions it as per-clip setting. Schema supports it. API contract drafts it. CSS already has radio button styles. Small implementation surface.

### Q8: Dirty state — clip switching?
**A:** Confirmation dialog. "Anda memiliki perubahan yang belum disimpan. Tinggalkan tanpa menyimpan?" Two options: "Buang & Pindah" (discard) and "Simpan & Pindah" (save then switch).

### Q9: BullMQ — this batch or later?
**A:** Later (H-08). `backend/package.json` has no BullMQ/Redis dependency. No `queues/` or `workers/` directories. FRD says C was supposed to set up foundation at H-02 with A/B coordination. Swapping `setTimeout` with `queue.add()` is one-line change. This batch already has substantial scope.

### Q10: Route mounting?
**A:** New file `clip-edit.routes.js` mounted at `/api`. Existing `clip.routes.js` stays at `/api/projects` for project-scoped routes. Clip-level routes (`PATCH /clips/:clipId`, etc.) need `/api/clips/:clipId`.

---

## Grilling Trace

### Topic 1: Save Architecture

```
Q: "Save" — one endpoint or two?
  → Explored: combined RFC contract vs API contract separation
  → Analysis: API contract defines PATCH + POST /render as separate
  → User: "which one closer to PRD and current codebase"
  → Analysis: PRD line 150 "Editor ringan (nudge time + text edit)", FRD line 247 "menghubungkan penyimpanan edit ke job render ulang"
  → Recommendation: Option B (two-step) — matches contract and FRD
  → User: "yes choose this one"
  → Decision 1 locked
```

### Topic 2: Transcript Mutability

```
Q: What's mutable in transcript_json?
  → User: "how's the PRD said about it"
  → Analysis: FRD line 91 "UI In-Place Subtitle Text Correction", line 161 "penyuntingan subtitle kata demi kata"
  → Transcript schema: { words: [{ word, start_time, end_time, confidence }] }
  → User: "which option is more efficient" (separate endpoint vs add to list)
  → Analysis: Current polls every 5s, transcript ~10-25KB per clip, 3-5 clips = 30-125KB per poll
  → Recommendation: Separate endpoint — avoids bloating polls
  → User: "yes"
  → Decision 2 locked
```

### Topic 3: Nudge Enforcement

```
Q: 25-75s enforcement — frontend, backend, or both?
  → User: "it does not extend to user edits via the editor"
  → Analysis: FRD validation applies to curation pipeline, not editor
  → Decision 3 locked: frontend-only
```

### Topic 4: manual_review_required

```
Q: Where does the flag live?
  → Analysis: ADR-0007 already dropped it. No schema column exists
  → User: "a" (ignore — doesn't exist)
  → Decision 4 locked
```

### Topic 5: Render Endpoint

```
Q: Render endpoint — stub or real?
  → User: "how to PRD or FRD said about it"
  → Analysis: FRD H-06 "Menyelesaikan editor dan API delta re-render per klip"
  → Same person (C) owns both
  → User: "ok" (real endpoint)
  → Decision 6 locked
```

### Topic 6: Subtitle Style

```
Q: In scope or deferred?
  → User: "is it mentioned in FRD?"
  → Analysis: FRD line 150 schema, line 166 "gaya subtitle", line 168 "Worker memakai pilihan tersimpan"
  → User: "yes" (include)
  → Decision 7 locked
```

### Topic 7: Dirty State

```
Q: Clip switching — discard, confirm, or auto-save?
  → User: "b" (confirmation dialog)
  → Decision 8 locked
```

### Topic 8: BullMQ

```
Q: Integrate now or later?
  → Analysis: No BullMQ dependency, no queues/ or workers/ dirs, FRD says H-02 foundation not done
  → Recommendation: Defer to H-08, use setImmediate for MVP
  → User: "ok"
  → Decision 9 locked
```

### Topic 9: Backend vs Frontend First

```
Q: Which to build first?
  → Recommendation: Backend first — frontend depends on API response shapes
  → User: "yes" (start with backend)
```

### Topic 10: lastEditActivityAt Gap

```
Q: FRD requires lastEditActivityAt update on edit — gap found
  → User: "yws" (yes, add it)
  → Fixed: added updateLastEditActivity to project.model.js
```

---

## Implementation Results

### Backend (5 files)

| File | Change |
|------|--------|
| `backend/src/models/project.model.js` | Added `updateLastEditActivity(projectId)` |
| `backend/src/models/clip.model.js` | Added `findByIdWithOwnership`, `findById`, `findTranscriptById`, `updateById` + `clipSelectDetail` |
| `backend/src/services/clip.service.js` | Added `updateClip`, `getTranscript`, `renderClip` with ownership verification and `lastEditActivityAt` update |
| `backend/src/controllers/clip.controller.js` | Added `update`, `getTranscript`, `render` handlers |
| `backend/src/routes/clip-edit.routes.js` | **New file** — PATCH, GET transcript, POST render |
| `backend/src/app.js` | Mounted clip-edit routes at `/api` |

### Frontend (3 files)

| File | Change |
|------|--------|
| `frontend/src/features/clips/clips.api.js` | Added `fetchTranscript`, `updateClip`, `renderClip` |
| `frontend/src/features/clips/EditorPage.jsx` | Full rewrite: nudge controls, title input, subtitle word editor, subtitle style selector, save/render buttons, confirmation dialog, dirty state tracking |
| `frontend/src/features/clips/editor.css` | Added dialog overlay, word list, word input styles |

### Verification

- **104/105 tests pass** — 1 pre-existing failure (talking-head template render, unrelated)
- All backend imports verified
- Frontend files verified

---

## Files Created/Changed

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/models/project.model.js` | Edited | Add `updateLastEditActivity` |
| `backend/src/models/clip.model.js` | Edited | Add `findByIdWithOwnership`, `findById`, `findTranscriptById`, `updateById` |
| `backend/src/services/clip.service.js` | Edited | Add `updateClip`, `getTranscript`, `renderClip` |
| `backend/src/controllers/clip.controller.js` | Edited | Add `update`, `getTranscript`, `render` |
| `backend/src/routes/clip-edit.routes.js` | **Created** | Clip-level routes (PATCH, GET transcript, POST render) |
| `backend/src/app.js` | Edited | Mount clip-edit routes at `/api` |
| `frontend/src/features/clips/clips.api.js` | Edited | Add `fetchTranscript`, `updateClip`, `renderClip` |
| `frontend/src/features/clips/EditorPage.jsx` | Edited | Full rewrite with editor controls |
| `frontend/src/features/clips/editor.css` | Edited | Add dialog, word list, button states |

---

## Verification Against Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Nudge blocks `start >= end` and 25–75s | **PASS** | `canNudgeStartMinus`, `canNudgeStartPlus`, `canNudgeEndMinus`, `canNudgeEndPlus` |
| 2 | Edited transcript sent on save | **PASS** | `handleSave` maps `editedWords` over `transcript.words` |
| 3 | Tested against WER-gate-failed sample | **NOT TESTED** | No sample exists. Noted per RFC guidance |
| 4 | Frontend connected to real API, no mocks | **PASS** | Real endpoints in `clips.api.js` |
| 5 | Writes land correctly in `clips` | **PASS** | `updateClip` writes all fields via Prisma |
| 6 | Tested against 3 real clips | **NOT TESTED** | Manual testing required before merge |
| 7 | Cross-reviewed | **NOT DONE** | PR + review required |

---

## Known Limitations

1. **Render uses `setImmediate`** — runs in-process, not a separate worker. Violates NFR-2 but acceptable until BullMQ is wired at H-08. Swap is one-line change.
2. **No `lastEditActivityAt` on render** — only `updateClip` updates it. Render endpoint doesn't touch `lastEditActivityAt` (not required by FRD for render).
3. **SRT generation not included** — `generateSrt` exists in `subtitleBurner.js` but not called from render endpoint. Can be added in H-07.
4. **No export endpoint yet** — `GET /clips/{id}/exports/{format}` is FRD H-07 task.
5. **Preview canvas is static** — shows word list as subtitle preview, not actual video playback. Real video preview needs media serving infrastructure.
