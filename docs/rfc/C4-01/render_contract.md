# Render Function Contract (C4-01)

Shared render interface that all three template implementations (Batch 2) build against.

## Function Signature

```js
/**
 * @param {string} inputPath - Local filesystem path to the source video
 * @param {number} startTime - Start time in seconds (inclusive)
 * @param {number} endTime - End time in seconds (exclusive)
 * @param {string} outputPath - Full path including filename for the output file
 * @param {object} [options={}]
 * @param {number} [options.timeoutMs] - Override the default 60s timeout
 * @returns {Promise<RenderResult>}
 */
async function reframe(inputPath, startTime, endTime, outputPath, options = {}) { ... }
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

Trimming (`startTime`/`endTime`) is applied before any template-specific reframing. The function handles trimming internally — callers do not need a separate trim step.

## Timeout

Default timeout: 60 seconds (constant `DEFAULT_TIMEOUT_MS`). Overridable per-call via `options.timeoutMs`. On timeout, the FFmpeg process is killed and the result resolves with `success: false, error: "timeout"`.

## Error Handling

- **Input validation failure**: resolves with `success: false` and a descriptive error string (e.g., `"Input file not found: {path}"`)
- **FFmpeg crash/error**: resolves with `success: false` and the truncated FFmpeg stderr as the error string
- **Timeout**: resolves with `success: false, error: "timeout"`

## Output Path Convention

```
{project_id}/{clip_id}/vertical.mp4    — rendered video
{project_id}/{clip_id}/subtitles.srt   — SRT file (H-5, path planned here for consistency)
```

The caller constructs the full path. `reframe` ensures the output directory exists.

## Camera-Box Assumption (Template A)

Template A (Slide+Cam) places the camera box at a fixed position. This is an **assumption**, not a guarantee — face/screen detection is explicitly out of scope per the FRD risk table.

```js
const CAMERA_BOX_POSITION = 'bottom-right';
const CAMERA_BOX_COORDS = { x: 70, y: 60, width: 25, height: 35 }; // percentages
```

These are named constants, overridable at module level before deployment. They are not per-call options.

## Module Exports

```js
module.exports = { reframe, DEFAULT_TIMEOUT_MS, CAMERA_BOX_POSITION, CAMERA_BOX_COORDS };
```

Direct export (not a factory function) — `reframe` has no injected dependencies.

## Batch 2 Usage

Templates B (Talking-Head) and C (Slide Saja) use `fluent-ffmpeg`'s standard chainable methods. Template A (Slide+Cam) uses `.complexFilter()` with raw filter-graph syntax for overlay compositing. All three use the same library, different features.

## What This Does Not Cover

- Subtitle burning (H-5)
- Queue/worker integration (H-8) — this function is stateless and callable from a BullMQ worker without refactoring
- SRT generation
- Template-specific reframe logic (Batch 2: C4-02, C4-03, C4-04)
