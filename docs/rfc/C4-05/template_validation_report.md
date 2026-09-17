# C4-05: Cross-Template Validation Report

**Generated:** 2026-09-17T07:07:15.021Z
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

H-5 may proceed with subtitle placement now. Template A uses a three-band layout: slide (1080×1152), subtitle band (1080×192, black), camera (1080×576). Subtitle is rendered into the dedicated middle band with MarginV=672.

**Verified against code:** Template A uses `concat` to stack three bands: slide (1080×1152), subtitle band (1080×192 black via `color` filter), and camera (1080×576). Subtitle MarginV is set to 672 to center text in the middle band. See `templateASlideCam.js:44` and `clip.service.js:150`.

**Platform overlap:** TikTok and Reels interaction icons (like, comment, share, follow) sit in the mid-to-lower right edge of the screen. Template A's camera band (y=1344–1920) overlaps this area, but subtitle text is now in the middle band (y=1152–1344), reducing conflict risk.

This constraint is TEMPORARY and should be re-validated once C4-02's PiP rework ships — at that point the exclusion zone shrinks to a small corner inset rather than a full-width band. When PiP lands, this safe-zone section must be explicitly updated to reflect the lifted constraint.
