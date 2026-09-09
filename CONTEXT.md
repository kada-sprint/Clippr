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
The integer value (0–100) assigned to a clip by the scoring rubric. Stored as `concept_score` in the `clips` database table.
_Aavoid_: Score, rating, completeness score

**Clip**:
A vertical video segment (9:16) extracted from a webinar, scored for concept completeness, and ready for export as MP4 + SRT.
_Avoid_: Segment, highlight, snippet

**Vertical Reframe**:
The process of converting horizontal webinar video (16:9) to vertical format (9:16) using FFmpeg template-based reframe.
_Avoid_: Crop, resize, convert

**Delta Re-render**:
Re-rendering only the modified portion of a clip (e.g., subtitle text change) rather than re-rendering the entire clip.
_Avoid_: Partial render, incremental render
