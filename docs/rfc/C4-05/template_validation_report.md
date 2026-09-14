# C4-05: Cross-Template Validation Report

**Generated:** 2026-09-13T10:17:15.103Z
**Test duration requested:** 5s
**Duration tolerance:** ±0.1s

## Per-Template Results

| Template | Resolution | Codec | Container | Duration (s) | Drift (s) | Drift OK |
|----------|------------|-------|-----------|-------------|-----------|----------|
| slide-cam | 1080×1920 ✓ | h264 ✓ | mov,mp4,m4a,3gp,3g2,mj2 | 5.012 | 0.012 | ✓ |
| talking-head | 1080×1920 ✓ | h264 ✓ | mov,mp4,m4a,3gp,3g2,mj2 | 5.012 | 0.012 | ✓ |
| slide-only | 1080×1920 ✓ | h264 ✓ | mov,mp4,m4a,3gp,3g2,mj2 | 5.012 | 0.012 | ✓ |

## Cross-Template Consistency

**Verdict: PASS** — all three templates produce spec-consistent output.

## Subtitle Safe-Zone Flag (PROVISIONAL)

H-5 may proceed with subtitle placement now, under one constraint: avoid the bottom 30% of the canvas, which is currently occupied by Template A's camera band (stacked model, pre-PiP-rework).

**Verified against code:** Template A's camera overlay is placed at `overlay=0:1344` with dimensions 1080×576 — the bottom 30% of the 1920px canvas (1344px = 70% from top). This is the exact shipped boundary in `templateASlideCam.js:40`, not an estimate.

**Platform overlap:** TikTok and Reels interaction icons (like, comment, share, follow) sit in the mid-to-lower right edge of the screen. Template A's bottom band directly overlaps this area, carrying real conflict risk with subtitle text placed there.

This constraint is TEMPORARY and should be re-validated once C4-02's PiP rework ships — at that point the exclusion zone shrinks to a small corner inset rather than a full-width band. When PiP lands, this safe-zone section must be explicitly updated to reflect the lifted constraint.
