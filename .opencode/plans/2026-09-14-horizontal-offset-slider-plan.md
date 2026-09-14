# Horizontal Position Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a horizontal position slider to the clip editor that lets users adjust the crop center for the `talking-head` layout, fixing the issue where off-center speakers get their faces cut off.

**Architecture:** Persist `horizontalOffset` per-clip in PostgreSQL via Prisma. Expose a range slider in the frontend EditorPage (only for `talking-head` layout). Pass the offset to FFmpeg's existing crop filter in Template B.

**Tech Stack:** Prisma, PostgreSQL, Express, React, FFmpeg (fluent-ffmpeg)

## Global Constraints

- Frontend: React with Vite, JavaScript/JSX
- Backend: Express/Node.js, JavaScript
- Database: PostgreSQL with Prisma ORM
- Range: -0.4 to 0.4, step 0.01, default 0
- UI text in Indonesian matching existing codebase

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/prisma/schema.prisma` | Modify | Add `horizontalOffset` field to Clip model |
| `backend/src/models/clip.model.js` | Modify | Include `horizontalOffset` in select objects; add project relation to list select |
| `backend/src/services/clip.service.js` | Modify | Add to MUTABLE_FIELDS, validate range, pass to render |
| `frontend/src/features/clips/EditorPage.jsx` | Modify | Add slider state, UI, dirty-check, save logic |
| `frontend/src/features/clips/editor.css` | Modify | Style range input |

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `backend/prisma/schema.prisma:47-68`

**Interfaces:**
- Produces: Clip model with `horizontalOffset Float @default(0) @map("horizontal_offset")`

- [ ] **Step 1: Add field to Prisma schema**

In `backend/prisma/schema.prisma`, add to the Clip model (after line 62, before `project`):

```prisma
  horizontalOffset Float @default(0) @map("horizontal_offset")
```

- [ ] **Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: Success message

- [ ] **Step 3: Create and apply migration**

Run: `npx prisma migrate dev --name add-horizontal-offset`
Expected: Migration created and applied

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): add horizontalOffset column to clips table"
```

---

### Task 2: Backend Model Updates

**Files:**
- Modify: `backend/src/models/clip.model.js:5-14,24-30`

**Interfaces:**
- Consumes: Prisma Clip model with `horizontalOffset` field
- Produces: Updated select objects that include `horizontalOffset`; list query includes project layout

- [ ] **Step 1: Add horizontalOffset to clipSelect**

In `backend/src/models/clip.model.js`, update `clipSelect` (line 5-14):

```js
const clipSelect = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  clipVideoPath: true,
  subtitledVideoPath: true,
  status: true,
  subtitleStyle: true,
  horizontalOffset: true,
};
```

- [ ] **Step 2: Add project relation to clipSelect for layout info**

Update `clipSelect` to include project layout (for frontend to know if slider should show):

```js
const clipSelect = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  clipVideoPath: true,
  subtitledVideoPath: true,
  status: true,
  subtitleStyle: true,
  horizontalOffset: true,
  project: { select: { selectedLayout: true } },
};
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/clip.model.js
git commit -m "feat(backend): include horizontalOffset and project layout in clip queries"
```

---

### Task 3: Backend Service — Validation and Render Pass-through

**Files:**
- Modify: `backend/src/services/clip.service.js:12,55-78,109-117`

**Interfaces:**
- Consumes: `clip.horizontalOffset` from database
- Produces: `options.horizontalOffset` passed to `reframeCommon.renderClip()`

- [ ] **Step 1: Add horizontalOffset to MUTABLE_FIELDS**

In `backend/src/services/clip.service.js`, line 12, add `'horizontalOffset'`:

```js
const MUTABLE_FIELDS = ['title', 'startTime', 'endTime', 'transcriptJson', 'subtitleStyle', 'horizontalOffset'];
```

- [ ] **Step 2: Add validation in updateClip**

In `updateClip()`, after the `subtitleStyle` validation block (around line 68), add:

```js
if (sanitized.horizontalOffset !== undefined) {
  const val = Number(sanitized.horizontalOffset);
  if (Number.isNaN(val) || val < -0.4 || val > 0.4) {
    throw new AppError(400, 'INVALID_HORIZONTAL_OFFSET', 'Posisi horizontal harus antara -0.4 dan 0.4.');
  }
  sanitized.horizontalOffset = val;
}
```

- [ ] **Step 3: Pass horizontalOffset to renderClip**

In `renderClip()` method, update the `renderClip()` call (line 111-117) to pass options:

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

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/clip.service.js
git commit -m "feat(backend): validate and pass horizontalOffset to FFmpeg render"
```

---

### Task 4: Frontend — Add Slider State and UI

**Files:**
- Modify: `frontend/src/features/clips/EditorPage.jsx:26-30,51-59,61-70,79-89,124-147,154-177,373-395`

**Interfaces:**
- Consumes: `clip.horizontalOffset` from API, `clip.project.selectedLayout` for conditional display
- Produces: `horizontalOffset` field in PATCH update payload

- [ ] **Step 1: Add state for horizontalOffset**

In `EditorPage.jsx`, after line 30 (`editedSubtitleStyle`), add:

```js
const [editedHorizontalOffset, setEditedHorizontalOffset] = useState(0);
```

- [ ] **Step 2: Add to originalValues useMemo**

In the `originalValues` useMemo (line 51-59), add `horizontalOffset`:

```js
const originalValues = useMemo(() => {
  if (!clip) return null;
  return {
    title: clip.title || '',
    startTime: Number(clip.startTime),
    endTime: Number(clip.endTime),
    subtitleStyle: clip.subtitleStyle || 'clean',
    horizontalOffset: clip.horizontalOffset ?? 0,
  };
}, [clip]);
```

- [ ] **Step 3: Add to isDirty check**

In the `isDirty` useMemo (line 61-70), add the check:

```js
editedHorizontalOffset !== originalValues.horizontalOffset ||
```

- [ ] **Step 4: Reset state when clip changes**

In the `useEffect` that resets state (line 79-106), add after line 88:

```js
setEditedHorizontalOffset(clip.horizontalOffset ?? 0);
```

- [ ] **Step 5: Add to handleSave patch**

In `handleSave` (line 154-177), add to the `updateClip` call:

```js
await updateClip(clip.id, {
  title: editedTitle,
  startTime: editedStartTime,
  endTime: editedEndTime,
  subtitleStyle: editedSubtitleStyle,
  horizontalOffset: editedHorizontalOffset,
  transcriptJson: words ? { words } : undefined,
});
```

- [ ] **Step 6: Add to handleConfirmSave patch**

In `handleConfirmSave` (line 124-147), add to the `updateClip` call:

```js
await updateClip(clip.id, {
  title: editedTitle,
  startTime: editedStartTime,
  endTime: editedEndTime,
  subtitleStyle: editedSubtitleStyle,
  horizontalOffset: editedHorizontalOffset,
  transcriptJson: words ? { words } : undefined,
});
```

- [ ] **Step 7: Add slider UI**

After the subtitle style fieldset (line 395), add the slider, conditionally rendered for `talking-head` layout:

```jsx
{clip.project?.selectedLayout === 'talking-head' && (
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
    <small>
      {editedHorizontalOffset > 0
        ? `${(editedHorizontalOffset * 100).toFixed(0)}% kanan`
        : editedHorizontalOffset < 0
        ? `${(Math.abs(editedHorizontalOffset) * 100).toFixed(0)}% kiri`
        : 'Tengah'}
    </small>
  </div>
)}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/clips/EditorPage.jsx
git commit -m "feat(frontend): add horizontal position slider for talking-head layout"
```

---

### Task 5: Frontend — Style Range Input

**Files:**
- Modify: `frontend/src/features/clips/editor.css:61-64`

**Interfaces:**
- Consumes: Existing CSS variables and dark theme colors
- Produces: Styled range input matching the UI

- [ ] **Step 1: Add range input styles**

In `editor.css`, after the `.editor-field textarea` rule (line 63), add:

```css
.editor-field input[type="range"] {
  width: 100%;
  accent-color: #3894ff;
  margin: 4px 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/clips/editor.css
git commit -m "style(frontend): add dark theme styling for range input"
```

---

### Task 6: Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run lint/typecheck**

Run: `npm run lint` (or equivalent) in both `backend/` and `frontend/`
Expected: No errors

- [ ] **Step 2: Verify Prisma client generates**

Run: `npx prisma generate` in `backend/`
Expected: Success

- [ ] **Step 3: Manual smoke test**

1. Start backend and frontend
2. Create a project with `talking-head` layout
3. Open editor, select a clip
4. Verify slider appears below subtitle style
5. Adjust slider, save, render
6. Verify the rendered video has the adjusted crop position
7. Switch to a `slide-cam` project — verify slider is hidden
