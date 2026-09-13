# Grilling Session Export — H5 Batch 2: Clip Result Card

**Date:** 2026-09-13
**RFC:** `cuplik_h_5_batch_2_ui_clip_card.md`
**Participants:** Orang C (implementation), AI (grilling)
**Outcome:** All questions resolved. Implementation complete.

---

## Resolved Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Should `needs_review` status stay? | **Yes** — fourth status variant alongside `pending`, `rendered`, `error` | Curation service already writes `needs_review` for fallback clips. Dropping it would require changing curation logic. |
| 2 | `manual_review_required` flag per RFC? | **Dropped** — conflicts with ADR-0007 | ADR-0007 explicitly dropped this flag. WER computation unavailable at runtime. Per-word `confidence` is the available quality signal. |
| 3 | `clip_video_path` — one path or two? | **Two fields**: `clip_video_path` (raw reframe) + `subtitled_video_path` (burned subtitles) | Preserves raw reframe for re-rendering with different subtitle styles (per ADR-0007). Clean, explicit. |
| 4 | Who implements `GET /projects/:id/clips`? | **Orang C, in Batch 2 scope** | Acceptance criteria requires real API data. Endpoint is Orang C's domain per AGENTS.md. |
| 5 | Polling scope? | **Clip card polling on EditorPage only** | QueuePage polling is a separate concern. Batch 2 focuses on clip status badges. |
| 6 | Preview player source selection? | **Best available version, silently** | `subtitled_video_path \|\| clip_video_path`. No user-facing indicator needed. |
| 7 | Empty/loading/error state ownership? | **Parent page (EditorPage) owns fetch** | Aligns with existing codebase patterns (AuthProvider, ProjectAccess). Cards are pure presentational. |
| 8 | `concept_score` display format? | **Not displayed on card** | User decided these are processing-only fields, not needed for card display. |
| 9 | Batch 1 dependency for real data? | **Batch 1 done** | Clips exist in DB. No blocking dependency. |
| 10 | Polling granularity? | **Full list** — `GET /projects/:id/clips` | Simpler, one request, handles new clips appearing during processing. |

---

## Scope Deviations from RFC

| RFC Says | Decision | Impact |
|----------|----------|--------|
| Card shows `concept_score` and `pedagogical_reason` | **Not displayed** — processing-only fields | Card shows: title, time range, subtitle, status badge |
| Status badge: `pending/rendered/error` | **Extended** to `pending/needs_review/rendering/rendered/error` | `needs_review` from curation, `rendering` for future render pipeline |
| Retry affordance for failed render | **Deferred** — RFC says "can land in later batch" | Error badge shown, no retry button |

---

## Implementation Summary

### Backend (new files)
- `backend/src/models/clip.model.js` — `findManyByProjectId()`
- `backend/src/services/clip.service.js` — `listClips()` with ownership check
- `backend/src/controllers/clip.controller.js` — `list()` handler
- `backend/src/routes/clip.routes.js` — `GET /:id/clips`
- `backend/src/app.js` — mounted clip routes
- `backend/prisma/schema.prisma` — added `subtitledVideoPath`
- Migration: `20260913143951_add_subtitled_video_path`

### Frontend (new files)
- `frontend/src/features/clips/clips.api.js` — `fetchClips()`
- `frontend/src/features/clips/components/ClipCard.jsx` — presentational card
- `frontend/src/features/clips/useClipPolling.js` — 5s polling hook

### Frontend (modified)
- `frontend/src/features/clips/EditorPage.jsx` — refactored for real API
- `frontend/src/features/clips/editor.css` — status badges + empty states

---

## Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| Frontend connected to real API/data, no mocks | ✅ | `useClipPolling` → `fetchClips()` → `GET /projects/:id/clips` |
| Writes land correctly in `clips` | ✅ | Done by Orang B (Batch 1) |
| Manually tested against 3 real clips | ⚠️ | Needs manual testing before merge |
| Cross-reviewed by another team member | ⚠️ | Process step before merge |

---

## Remaining Before Batch 3

1. **Manual testing** — Run backend, create project with 3+ clips, open `/editor?projectId=...`, verify:
   - Clips load from API
   - Status badges display correctly
   - Polling updates within 5s
   - Empty state shows when no clips
   - Error state shows when backend is down

2. **Cross-review** — Another team member reviews the PR

3. **Run migration** — `cd backend && npx prisma migrate dev`

---

## Domain Model Updates

### New terms added to CONTEXT.md
- **Clip Status** — `pending | needs_review | rendering | rendered | error`
- **Raw Reframe** — The initial 9:16 vertical render without subtitles, stored at `clip_video_path`
- **Subtitled Render** — The vertical render with burned subtitles, stored at `subtitled_video_path`

### ADR created
- `0008-two-field-video-path.md` — Two separate path fields for raw and subtitled renders
