# Cuplik — Domain Context

Cuplik is an AI-powered video repurposing system for webinars. It ingests long-form webinar recordings, transcribes them, and curates vertical clips based on "Concept Completeness" — ensuring each clip is self-contained and educationally valuable.

## Language

**Concept Completeness Score**:
A numeric score (0–100) measuring whether a clip is a self-contained educational unit. Composed of three structural parts: opener, elaboration, and conclusion.
_Avoid_: Quality score, relevance score

**Pembuka Kontekstual (Opener)**:
The opening segment of a clip where the speaker defines a problem, premise, or poses a key question.
_Avoid_: Intro, hook, teaser

**Elaborasi / Solusi (Elaboration)**:
The middle segment of a clip containing the core explanation, examples, or solution. Scored on specificity (concrete details vs. vague claims) and connective tissue (causal reasoning vs. listing).
_Aavoid_: Body, main content, middle

**Kesimpulan Mandiri (Self-Contained Conclusion)**:
The closing segment of a clip that signals closure without introducing new claims. Must have a discourse marker (e.g., "jadi/intinya/kesimpulannya") or equivalent.
_Avoid_: Outro, ending, wrap-up

**Transcript Input**:
Word-level JSON output from the ASR pipeline. Each word carries a text token, start time, and end time in seconds. No speaker diarization.
_Avoid_: Transcript JSON, word-level data

**Concept Score**:
The raw integer score (0–98) assigned by the LLM scoring rubric, before normalization. Normalized to 0.0–1.0 at storage time in the service layer. Stored as `concept_score` in the `clips` database table.
_Avoid_: Score, rating, completeness score

**Clip**:
A vertical video segment (9:16) extracted from a webinar, scored for concept completeness, and ready for export as MP4 + SRT.
_Avoid_: Segment, highlight, snippet

**Vertical Reframe**:
The process of converting horizontal webinar video (16:9) to vertical format (9:16) using FFmpeg template-based reframe.
_Avoid_: Crop, resize, convert

**Delta Re-render**:
Re-rendering only the modified portion of a clip (e.g., subtitle text change) rather than re-rendering the entire clip.
_Avoid_: Partial render, incremental render

**Dry-Run Integration Test**:
An end-to-end test of the curation pipeline components (chunker → prompt builder → LLM call → schema validation → fallback parser) without database writes or live API calls. Uses a mock LLM and sample transcripts to verify the chain works before live integration.
_Avoid_: Dry-run validation, validation test, mock test

**Mock LLM**:
A stub function that returns canned LLM responses matching the clip output schema. Used in dry-run tests to exercise the parsing and validation chain without calling a real API. Distinct from "sample transcript" which is input data.
_Avoid_: Stub LLM, fake LLM, mocked response

**Sample Transcript**:
A JSON fixture file containing word-level timestamps (as defined by Transcript Input) used as input for testing. The canonical sample is `docs/rfc/C2-01/sample_transcript_mock.json`.
_Avoid_: Mock transcript, test transcript, fixture transcript

**Pipeline Components**:
The curation pipeline parts that can be tested in isolation: chunker, prompt builder, LLM call (mocked), response parser, and schema validator. Excludes database persistence (Prisma) and HTTP layer.
_Avoid_: Full pipeline, end-to-end pipeline, curation chain

**Token Cost Projection**:
Estimated LLM API cost for processing a full video, computed from per-chunk token counts multiplied by provider pricing. Based on real API calls, not estimates.
_Avoid_: Cost estimate, API cost

**Adaptive Top-N**:
Post-curation selection strategy that sorts clips by concept_score descending and returns the top N (default 5), without a minimum score threshold. Ensures clips are always returned for non-empty transcripts.
_Avoid_: Score filtering, quality gate

**Worker**:
A Node.js process that consumes jobs from BullMQ queues and executes heavy tasks (FFmpeg, ASR, LLM) outside the Express HTTP thread. Each worker process has its own Prisma Client instance. Workers never share state with the API server.
_Avoid_: processor, job handler, background task
