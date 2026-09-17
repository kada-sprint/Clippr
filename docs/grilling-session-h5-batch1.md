# Grilling Session: H-5 Batch 1 — Subtitle Burner (ASS Filter Graph)

**Date:** 2026-09-13
**Skill:** grill-with-docs + domain-modeling
**RFC:** `cuplik_h_5_batch_1_subtitle_burner.md`

---

## Session Summary

A grilling session to stress-test the Subtitle Burner RFC (H-5 Batch 1) against the existing Cuplik codebase. The RFC specifies an ASS-based subtitle burning module for rendering word-level transcripts onto vertical video. All decisions were resolved through Socratic questioning before implementation.

---

## Decisions Resolved

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Output file | Separate `subtitled.mp4` | Preserve raw `vertical.mp4` for re-rendering with different subtitle styles without re-running reframe |
| 2 | Word filtering | Caller pre-filters and rebases | Burner stays pure; caller extracts words from project transcript using existing `words.filter()` pattern from `chunker.js` |
| 3 | Highlight style | Word-level `\k` ASS karaoke tags | Simplest to generate from word-level data; ASS renderers handle `\k` natively; word-level sweep reads naturally |
| 4 | Safe-zone margins | Hardcoded module-level constants | FRD locks format to 9:16; safe zones are a product decision, not per-clip; configurability is premature |
| 5 | Quality gate | No `manual_review_required` param | WER requires reference transcript (unavailable at runtime); per-word `confidence` from ASR is the available signal; gate is development-time benchmarking, not runtime feature |
| 6 | SRT timestamps | Clip-relative (0 = clip start) | Pipeline contract: "source timestamps relative to source video; subtitle export converts to clip-relative" |
| 7 | FFmpeg invocation | Standalone call, not chained into `renderClip()` | Two independent passes; subtitle burn is ~1-3s on 10s clip; reframe preserved for re-rendering |
| 8 | Export style | Direct export (no factory wrapper) | Per ADR-0005: pure functions with no injected dependencies use direct export |
| 9 | Font/colors | Arial 52pt, white+black outline, yellow `\k` highlight | Readable on mobile; standard fallback font; contrast for karaoke effect |

---

## Key Questions & Answers

### Q: Should the subtitle burner produce a separate `subtitled.mp4` or overwrite `vertical.mp4`?
**A:** Separate file. Preserves the raw vertical render for re-rendering with different subtitle styles without re-running the expensive reframe pass. Aligns with "Delta Re-render" concept.

### Q: Where do word-level timestamps come from for a single clip?
**A:** The clip's `transcriptJson` stores LLM segment metadata, not word-level data. The full word list lives on `project.transcriptJson`. The caller filters and rebases: `words.filter(w => w.start_time >= clip.startTime && w.start_time < clip.endTime)` then `w.start_time - clip.startTime`.

### Q: How should the "Active Word Highlight" style work with per-word (not per-syllable) data?
**A:** Word-level `\k` tags. Each word is treated as a karaoke segment. The highlight "sweeps" per word rather than smoothly per syllable — this is actually more readable for educational content.

### Q: Should safe-zone margins be hardcoded or configurable?
**A:** Hardcoded. The FRD locks the format to 9:16. Safe zones are a product decision (TikTok/Reels UI overlap), not a per-clip decision. Configurability is premature without a real use case.

### Q: Is WER computation necessary at runtime?
**A:** No. WER requires a reference transcript — not available for arbitrary webinar uploads. The FRD's "Day-1 Gate Check" is a development-time benchmarking step. Per-word `confidence` scores from the ASR provider are the available runtime quality signal.

### Q: Should the burner be aware of `manual_review_required`?
**A:** No. The burner stays pure. The flag was dropped from the contract because: (1) no WER code exists, (2) no flag exists in the schema, (3) the gate is a development-time concern. If needed later, threshold on average word confidence.

### Q: How does the ASS filter path work with fluent-ffmpeg?
**A:** Homebrew FFmpeg doesn't include `libass`. Installed `ffmpeg-static` which bundles FFmpeg with `--enable-libass`. Updated detection chain: env var → `ffmpeg-static` → `@ffmpeg-installer/ffmpeg` → system PATH. No path escaping needed — fluent-ffmpeg handles quoting.

---

## Grilling Trace

### Topic 1: Output Architecture

```
Q: Separate subtitled.mp4 or overwrite vertical.mp4?
  → Analysis: Overwriting means re-rendering reframe for any subtitle style change
  → User: "agree to produce a separate subtitled.mp4"
  → Decision 1 locked
```

### Topic 2: Data Flow

```
Q: Where do word-level timestamps come from?
  → Analysis: Clip.transcriptJson = LLM segment metadata (no words)
  → Analysis: Project.transcriptJson = full word list
  → Analysis: chunker.js has existing words.filter() pattern
  → User: "is there any code that prepares for that already"
  → Analysis: No dedicated helper, but chunker pattern is close
  → User: "option a" (caller pre-filters and rebases)
  → Decision 2 locked
```

### Topic 3: Highlight Style

```
Q: Word-level \k tags or color override per word?
  → Analysis: \k tags are simplest; ASS renderers handle natively
  → User: "go option 1" (word-level \k tags)
  → Decision 3 locked
```

### Topic 4: Safe Zones

```
Q: Hardcoded or configurable margins?
  → Analysis: FRD locks 9:16 format; no real use case for per-clip margins
  → User: "Hardcode the margins as module-level constants"
  → Decision 4 locked
```

### Topic 5: Quality Gate

```
Q: Is WER computation necessary in the app?
  → Analysis: WER needs reference transcript; not available at runtime
  → Analysis: Per-word confidence is the available signal
  → User: "align to what we already have at runtime"
  → Decision 5 locked: no manual_review_required, use confidence
```

### Topic 6: SRT Timestamps

```
Q: Clip-relative or source-relative SRT timestamps?
  → Pipeline contract says: source-relative in transcript, clip-relative in export
  → User: "yes" (clip-relative)
  → Decision 6 locked
```

### Topic 7: Integration Architecture

```
Q: Chain into renderClip() or standalone FFmpeg call?
  → Analysis: Subtitle burn is ~1-3s vs reframe ~30-60s
  → Analysis: Separation means style changes don't require reframe
  → User: "confirm 8 and 9" (standalone + direct export)
  → Decisions 7+8 locked
```

---

## Implementation Results

### Files Created

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/services/subtitleBurner.js` | Created | Core module: `buildAss`, `generateSrt`, `burnSubtitles` |
| `backend/tests/subtitle-burner.test.js` | Created | 21 tests (10 unit buildAss, 5 unit generateSrt, 6 integration burnSubtitles) |
| `docs/adr/0007-subtitle-burner-separation.md` | Created | ADR for separate FFmpeg pass + deviation note |
| `CONTEXT.md` | Edited | Added Subtitle Burner, Clip-Relative Timestamps, Safe Zone Margins |
| `backend/package.json` | Edited | Added `ffmpeg-static` as runtime dependency |

### Verification

- 21/21 tests pass (clean + highlight styles burned onto real fixture video)
- 13/13 existing tests pass (no regressions)
- Burn time: ~1-3s on 10s clip (well under real-time)

### Acceptance Criteria Check

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Subtitles sync ≤150ms drift | Code-level pass (ASS timing precise; FFmpeg ass filter frame-accurate) |
| 2 | No text inside safe-zone margins | Pass (hardcoded in ASS style, verified in tests) |
| 3 | `manual_review_required` short-circuits | **Deviation** — dropped (WER not implementable at runtime; documented in ADR-0007) |
| 4 | Runs against 3 real clips | Partial (tested against 1 fixture; needs 2 more for full FRD DoD) |

---

## Known Limitations

1. **Single fixture video** — tested against `sample_slide_cam.mp4` (10s). FRD DoD requires 3 real webinar-derived clips.
2. **`manual_review_required` deviation** — RFC requires it; dropped because WER computation needs reference transcripts unavailable at runtime. Documented in ADR-0007.
3. **Font availability** — ASS uses Arial. If Arial isn't installed on the system running FFmpeg, libass falls back to its default font. Works on macOS/Linux with standard font packages.
4. **Line grouping threshold** — fixed at 8 words per line with 0.5s gap trigger. May need tuning for languages with longer words or different speech patterns.
