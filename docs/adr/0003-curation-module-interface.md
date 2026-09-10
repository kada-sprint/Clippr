# Curation Module Interface

The `curateClips` function accepts `projectId` and a Prisma client, performing DB writes internally. The return type uses Prisma field names (`startTime`, `endTime`, `conceptScore`) plus the raw `concept_score` integer (0–98) needed for deduplication ranking.

## Considered Options

1. **Pure function** — rejected because it would require moving all DB logic to the caller, duplicating the insert/logging pattern across workers.

2. **Coupled to projectId + Prisma (chosen)** — aligns with existing `curateClips` signature, keeps DB writes co-located with curation logic, minimal caller wiring.

## Consequences

- Module requires Prisma for testing (worker provides this context)
- Return type is Prisma-shaped: `startTime`, `endTime`, `conceptScore` (normalized)
- Raw `concept_score` (0–98) is included for dedup ranking only
- LLM contract (prompt, schemas) stays snake_case — normalization is boundary concern
- No post-curation quality gate — clips are ranked by score and top-N returned as-is (Adaptive Top-N strategy)
