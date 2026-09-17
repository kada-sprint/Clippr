# Render Function Contract (C4-01)

Shared render interface that all three template implementations (Batch 2) build against.

## Function Signature

```js
/**
 * @param {string} inputPath - Local filesystem path to the source video
 * @param {number} startTime - Start time in seconds (inclusive)
 * @param {number} endTime - End time in seconds (exclusive)
 * @param {string} outputPath - Full path including filename for the output file
 * @param {string} template - Required: 'slide-cam' | 'talking-head' | 'slide-only'
 * @param {object} [options={}]
 * @param {number} [options.timeoutMs] - Override the default 60s timeout
 * @param {number} [options.horizontalOffset] - Template B only: normalized 0–1, positive = right, default 0
 * @returns {Promise<RenderResult>}
 */
async function renderClip(inputPath, startTime, endTime, outputPath, template, options = {}) { ... }
```

## RenderResult

```js
{
  success: boolean,      // true if render completed without errors
  outputPath: string | null, // absolute path to the output file on success, null on failure
  duration: number,      // rendered clip duration in seconds (endTime - startTime)
  error: string | null   // null on success; truncated FFmpeg stderr or error message on failure
}
```

The Promise **always resolves** — it never rejects. Rejection is reserved for truly unexpected exceptions (e.g., out-of-memory kill of the Node process itself). Expected failures (bad input, FFmpeg crash, timeout) resolve with `success: false`.

## Output Spec

All templates produce:
- Resolution: 1080×1920 (9:16 vertical)
- Video codec: H.264 (`libx264`)
- Audio: untouched passthrough from source (subtitle burning is H-5, not coupled here)

## Trimming

Trimming (`startTime`/`endTime`) is applied as output-side options via `applyTrim(command, startTime, endTime)` in `reframeCommon.js`. Output-side is frame-accurate; input-side seeks to nearest keyframe only. Frame accuracy is required because H-5 subtitle sync depends on exact clip boundaries.

## Timeout

Default timeout: 60 seconds (constant `DEFAULT_TIMEOUT_MS`). Overridable per-call via `options.timeoutMs`. On timeout, the FFmpeg process is killed and the result resolves with `success: false, error: "timeout"`.

## Error Handling

- **Input validation failure**: resolves with `success: false` and a descriptive error string (e.g., `"Input file not found: {path}"`)
- **FFmpeg crash/error**: resolves with `success: false` and the truncated FFmpeg stderr as the error string
- **Timeout**: resolves with `success: false, error: "timeout"`
- **Unknown template**: resolves with `success: false, error: "Unknown template: {template}"`

## Output Path Convention

```
{project_id}/{clip_id}/vertical.mp4    — rendered video
{project_id}/{clip_id}/subtitles.srt   — SRT file (H-5, path planned here for consistency)
```

The caller constructs the full path. `renderClip` ensures the output directory exists.

## Camera-Box Assumption (Template A)

Template A (Slide+Cam) places the camera box at a fixed position. This is an **assumption**, not a guarantee — face/screen detection is explicitly out of scope per the FRD risk table.

```js
const CAMERA_BOX_POSITION = { x: 0.85, y: 0.05, w: 0.15, h: 0.15 };
```

Normalized 0–1, origin top-left, fraction of source frame. This is a module-level constant in `reframeCommon.js`, not a per-call option. Template A imports it directly. See `docs/adr/0006-camera-band-tradeoff.md` for the trade-off this introduces.

## Module Exports

```js
module.exports = { renderClip, applyTrim, DEFAULT_TIMEOUT_MS, CAMERA_BOX_POSITION };
```

Direct export (not a factory function) — `renderClip` has no injected dependencies.

## Template Selection

`template` is a required positional parameter. Unrecognized or missing values resolve with `success: false` — no silent fallback. Accepted values match the `ALLOWED_LAYOUTS` enum in `project.service.js`: `'slide-cam'`, `'talking-head'`, `'slide-only'`.

## Batch 2 Usage

Templates B (Talking-Head) and C (Slide Saja) use `fluent-ffmpeg`'s standard chainable methods. Template A (Slide+Cam) uses `.complexFilter()` with raw filter-graph syntax for overlay compositing. All three use the same library, different features.

Workers call `renderClip()` — they never import template files directly. Templates are internal implementation details dispatched by `renderClip()`.

## What This Does Not Cover

- Subtitle burning (H-5)
- Queue/worker integration (H-8) — this function is stateless and callable from a BullMQ worker without refactoring
- SRT generation
- Template-specific reframe logic (Batch 2: C4-02, C4-03, C4-04)
