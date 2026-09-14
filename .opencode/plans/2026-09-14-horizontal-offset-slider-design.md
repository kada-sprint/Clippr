# Design: Horizontal Position Slider for Talking-Head Layout

## Problem

The `talking-head` layout (Template B) crops a centered vertical strip from the source video. When the speaker is positioned off-center in the source frame, their face gets cut off in the 9:16 output. Currently there is no way to adjust the crop position — the `horizontalOffset` parameter exists in the backend FFmpeg logic but is not exposed to the frontend or persisted.

## Solution

Add a horizontal position slider to the clip editor that controls the crop center point for the `talking-head` layout. The offset is persisted per-clip in the database.

## Scope

### In scope
- Add `horizontalOffset` field to Clip model (Prisma schema + migration)
- Expose slider in EditorPage UI, visible only for `talking-head` layout
- Include `horizontalOffset` in PATCH update and render pipelines
- Validate range: -0.4 to 0.4 (normalized, sufficient for most off-center positions)

### Out of scope
- Automatic face detection (separate future feature)
- Horizontal offset for `slide-cam` or `slide-only` layouts
- Per-project default offset setting

## Architecture

### Data Flow

```
User adjusts slider → EditorPage state → PATCH /clips/:clipId { horizontalOffset }
                                         → save to Clip table
User clicks Render → POST /clips/:clipId/render
                   → clip.service.js reads clip.horizontalOffset
                   → reframeCommon.js passes options.horizontalOffset
                   → templateBTalkingHead.js uses it in FFmpeg crop filter
```

### FFmpeg Filter (existing logic, no change needed)

```
[0:v]crop=ih*0.5625:ih:(iw/2+iw*{offset})-(ih*0.5625/2):0,scale=1080:1920:flags=lanczos
```

- `offset = 0` → centered crop (current default)
- `offset > 0` → crop shifts right (for speaker on right side)
- `offset < 0` → crop shifts left (for speaker on left side)

## Changes

### 1. Prisma Schema (`backend/prisma/schema.prisma`)

Add to Clip model:
```prisma
horizontalOffset Float @default(0) @map("horizontal_offset")
```

Create migration for the new column.

### 2. Backend Service (`backend/src/services/clip.service.js`)

- Add `'horizontalOffset'` to `MUTABLE_FIELDS` array (line 12)
- Add validation in `updateClip()`: must be a number between -0.4 and 0.4
- In `renderClip()`: pass `clip.horizontalOffset` to `renderClip()` from `reframeCommon.js` as part of options

Current render call (line 111-117):
```js
const reframeResult = await renderClip(
  project.sourceVideoPath,
  Number(clip.startTime),
  Number(clip.endTime),
  verticalPath,
  layout,
);
```

Updated:
```js
const reframeResult = await renderClip(
  project.sourceVideoPath,
  Number(clip.startTime),
  Number(clip.endTime),
  verticalPath,
  layout,
  { horizontalOffset: clip.horizontalOffset ?? 0 },
);
```

### 3. Frontend API (`frontend/src/features/clips/clips.api.js`)

No changes needed — `updateClip()` already sends arbitrary patch fields, and `renderClip()` reads from the saved clip.

### 4. Frontend Editor (`frontend/src/features/clips/EditorPage.jsx`)

Add state:
```js
const [editedHorizontalOffset, setEditedHorizontalOffset] = useState(0);
```

Add to `useMemo` for `originalValues`:
```js
horizontalOffset: clip.horizontalOffset ?? 0,
```

Add to `isDirty` check:
```js
editedHorizontalOffset !== originalValues.horizontalOffset
```

Add to `useEffect` that resets state when clip changes:
```js
setEditedHorizontalOffset(clip.horizontalOffset ?? 0);
```

Add to `handleSave` and `handleConfirmSave` patch payloads:
```js
horizontalOffset: editedHorizontalOffset,
```

Add slider UI in the editor panel, after subtitle style fieldset, only when layout is `talking-head`:
```jsx
{project?.selectedLayout === 'talking-head' && (
  <div className="editor-field">
    <label htmlFor="clip-horizontal-offset">Posisi Horizontal</label>
    <input
      id="clip-horizontal-offset"
      type="range"
      min="-0.4"
      max="0.4"
      step="0.01"
      value={editedHorizontalOffset}
      onChange={(e) => setEditedHorizontalOffset(Number(e.target.value))}
    />
    <small>{editedHorizontalOffset > 0 ? `${(editedHorizontalOffset * 100).toFixed(0)}% kanan` : editedHorizontalOffset < 0 ? `${(Math.abs(editedHorizontalOffset) * 100).toFixed(0)}% kiri` : 'Tengah'}</small>
  </div>
)}
```

### 5. Frontend CSS (`frontend/src/features/clips/editor.css`)

Style the range input to match existing dark theme:
```css
.editor-field input[type="range"] {
  width: 100%;
  accent-color: #3894ff;
}
```

## Access to `project.selectedLayout`

The EditorPage currently doesn't fetch project data. We need to either:
- Fetch project metadata when the page loads (via existing `fetchProject` or similar)
- Or pass layout info through the clips array (each clip already has `clip.project` relation)

Looking at the backend `listClips` response, clips include the project relation. The frontend can check `clip.project?.selectedLayout` or we add a project fetch.

**Decision:** Use `clip.project?.selectedLayout` if available from the clips API response, otherwise add a project fetch.

## Validation

- **Backend:** Clamp range -0.4 to 0.4 in `updateClip()`. Reject values outside range with 400 error.
- **Frontend:** HTML `min`/`max` attributes on range input provide native clamping.

## Testing

1. **Manual test:** Upload a video with off-center speaker, select `talking-head` layout, adjust slider, render, verify face is centered.
2. **Edge cases:** Slider at extremes (-0.4, 0.4), default (0), verify crop doesn't go out of bounds.
3. **Layout switch:** Verify slider only appears for `talking-head`, hidden for `slide-cam` and `slide-only`.
4. **Re-render:** Change offset, re-render, verify new offset is applied.

## Risks

- **Migration on production data:** Adding a column with `DEFAULT 0` is safe and non-destructive.
- **Out-of-bounds crop:** FFmpeg handles this gracefully — if crop extends beyond frame, it crops to available area. No crash.
