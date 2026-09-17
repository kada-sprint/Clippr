# Duration Policy Decision

The 25–75 second clip duration window is enforced at three layers in the pipeline — intentionally, not redundantly.

## Enforcement Points

1. **Prompt-level** (`curation_prompt.md` line 33): The LLM is instructed "Duranasi: Setiap clip harus 25-75 detik. Jangan potong kalimat di tengah." This reduces wasted LLM calls by steering the model away from unusable output before it's generated.

2. **Schema-level** (`clip-output-schema.js` line 6): Joi validates `duration: Joi.number().min(25).max(75).required()`. This is the safety net — clips that slip past the prompt instruction are caught and rejected before database insert.

3. **Service-layer** (`curation.service.js` line 63): The prompt built by `buildPrompt()` reinforces the constraint in the system instructions, ensuring it persists even if `curation_prompt.md` is refactored separately.

## Why Three Layers

This is defense-in-depth, not duplication. Each layer catches a different failure mode:

- Prompt wording can be ignored by the LLM (non-deterministic)
- Schema validation can be bypassed if someone changes the Joi schema
- Service-layer prompt ensures the instruction survives refactoring of the standalone prompt file

A future refactor that "cleans up" one layer without understanding this intent would silently weaken the pipeline.

## Decision

No code changes needed. The policy is already correctly implemented. Documented here to prevent accidental removal.
