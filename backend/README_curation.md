# Curation Module

The curation module selects conceptually complete clips from a webinar transcript using LLM-based scoring. It handles the full pipeline: chunking → prompting → LLM call → response validation → fallback parsing → deduplication → database write.

## Function Signature

```js
curateClips(projectId, transcript, { callLlm })
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string (UUID) | Yes | ID of an existing project in the database |
| `transcript` | object | Yes | Word-level JSON from the ASR pipeline |
| `callLlm` | function | No | Injectable LLM caller for testing (defaults to real API) |

## Input Format

The transcript must be a word-level JSON object:

```json
{
  "words": [
    { "word": "Banyak", "start_time": 0.0, "end_time": 0.36, "confidence": 0.95 },
    { "word": "guru", "start_time": 0.36, "end_time": 0.64, "confidence": 0.95 },
    { "word": "di", "start_time": 0.64, "end_time": 0.8, "confidence": 0.95 }
  ]
}
```

Each word must have: `word`, `start_time`, `end_time`, `confidence`.

## Output Format

Returns an array of clip objects (matches the `clips` database table shape):

```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "title": "AI Automated Grading: Solusi efisiensi penilaian guru",
    "startTime": 0,
    "endTime": 66.2,
    "conceptScore": 0.98,
    "pedagogicalReason": "Pembuka jelas, elaborasi spesifik, kesimpulan lengkap.",
    "status": "pending",
    "concept_score": 96
  }
]
```

**Field notes:**
- `conceptScore` (0.0–1.0): Normalized score stored in the database
- `concept_score` (0–98): Raw integer from the LLM rubric, included for dedup ranking only
- `status`: Set to `"pending"` for clean LLM output, `"needs_review"` for fallback-parsed segments

## Error Handling

The function throws errors in these cases:

| Condition | Error |
|-----------|-------|
| Transcript too short for chunking | `Transcript too short for chunking` |
| Fewer than 3 clips after dedup | `Kurasi gagal: hanya N klip ditemukan (minimal 3)` |
| LLM fails after 3 retries | `LLM timeout` or `LLM unreachable` |

On failure, the project status is set to `error` with the failed `processingStage`.

## Benchmark Numbers

From real API runs with gpt-5.6-luna (RFC-C3-05):

| Metric | Value |
|--------|-------|
| Avg input tokens per chunk | ~2,023 |
| Avg output tokens per chunk | ~277 |
| Avg latency per chunk | ~5.3s |
| Chunks for 45-min video | 9 |
| Projected cost per video | ~$0.0066 |

## Duration Policy

Clip duration is enforced at three layers (defense-in-depth):

1. **Prompt-level**: LLM is instructed to find segments of 25–75 seconds
2. **Schema-level**: Joi validates `duration: min(25).max(75)`
3. **Service-layer**: Prompt reinforcement ensures constraint survives prompt file refactoring

## Usage Example (Worker)

```js
const { curateClips } = require('./services/curation.service');

async function handleCurationJob(job) {
  const { projectId } = job.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project?.transcriptJson) {
    throw new Error('Transcript not found for project');
  }

  const clips = await curateClips(projectId, project.transcriptJson);

  return { clipCount: clips.length, clipIds: clips.map((c) => c.id) };
}
```

## Internal Pipeline

For contributors modifying the module internals:

```
transcript → createChunker() → [chunk1, chunk2, ...]
  for each chunk:
    → buildPrompt(chunk) → callLlm(prompt)
    → parseLlmResponse(raw) → validate with clipOutputSchema
    → on parse failure: parseFallback(raw) → validate with fallbackOutputSchema
    → insertClips(prisma, projectId, segments)
  → dedupClips(allClips) → sort by concept_score descending → top 5
  → return clips
```

Key files:
- `src/services/curation.service.js` — main module
- `src/services/chunker.js` — transcript splitting
- `src/services/fallback_parser.js` — malformed JSON recovery
- `src/utils/clip-output-schema.js` — LLM output validation
- `src/prompts/curation_prompt.md` — LLM prompt template
