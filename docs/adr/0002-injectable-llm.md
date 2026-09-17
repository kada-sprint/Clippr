# Injectable LLM Function

The curation service's `callLlm` is now an optional parameter on `curateClips()`, defaulting to a stub that returns empty segments. This allows dry-run integration tests to inject a mock LLM without touching the database or calling a real API.

## Considered Options

1. **Hardcoded `callLlm` with env-based switching** — rejected because it couples test configuration to runtime environment variables and makes the service harder to reason about.
2. **Separate `prompt_runner` module** — rejected as over-engineering for MVP; the injectable parameter achieves the same testability with less indirection.
3. **Injectable `callLlm` parameter (chosen)** — backward-compatible, minimal surface area, no new abstractions.

## Consequences

- `curateClips(projectId, transcript, { callLlm })` accepts an optional `callLlm` function
- Default `callLlm` returns `{segments: []}` (existing behavior preserved)
- `buildPrompt` and `parseLlmResponse` are now exported for direct testing
- Dry-run tests can exercise the full chunker → prompt → parse → validate chain without Prisma
