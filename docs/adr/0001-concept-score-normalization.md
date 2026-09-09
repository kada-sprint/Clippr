# Concept Score Normalization

The LLM outputs raw integer scores (0–98) from the rubric. Normalization to 0–1 happens in the service layer (`curation.service.js`) before database insert, not in the prompt. This preserves the rubric's integer arithmetic and avoids LLM fractional math errors.

## Considered Options

1. **LLM outputs 0–1 float** — rejected because LLMs make arithmetic errors with fractional values, and the rubric's integer addition (Opener + Elaboration − Penalties) is more reliable.
2. **LLM outputs 0–100 integer** — rejected because it would require rewriting the rubric and updating anchoring examples, violating the rubric's "do not modify wording" rule.
3. **LLM outputs 0–98 integer (chosen)** — preserves rubric wording, simple division in service layer.

## Consequences

- Rubric stays unchanged in the prompt
- Service layer does `score / 98` before Prisma insert
- Joi schema validates integer 0–98
- Prisma stores Decimal(4,3) which accommodates the normalized float
