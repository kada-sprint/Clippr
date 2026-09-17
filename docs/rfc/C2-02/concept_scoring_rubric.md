# Concept Completeness Scoring Rubric

**Purpose:** Convert the qualitative "Concept Completeness" philosophy (FRD §2) into an explicit, checkable scoring rubric an LLM can apply consistently.

**Output:** `concept_score` — integer 0–98 (max possible: Opener 25 + Elaboration 38 + Conclusion 35).

---

## Scoring Components

### 1. Pembuka Kontekstual (Opener) — 0–25 pts

| Range | Criteria |
|-------|----------|
| 21–25 | Opener clearly defines a problem, premise, or poses a key question within the first 20% of the clip. Context is immediately clear to a new viewer. |
| 11–20 | Opener is present but vague — hints at a topic without clearly framing a problem or question. |
| 1–10 | Opener exists but is unclear or buried — viewer must wait too long to understand the clip's purpose. |
| 0 | No identifiable opener — clip starts mid-elaboration or mid-thought. |

### 2. Elaborasi / Solusi (Elaboration) — 0–38 pts

Scored on two dimensions:

**Dimension A: Specificity** (does it give concrete examples/details vs. vague claims?)

| Level | Criteria |
|-------|----------|
| Low | Vague, generic claims with no examples ("AI membantu guru") |
| Medium | Some concrete examples or named concepts ("automated grading, personalized feedback") |
| High | Specific examples with quantified or detailed mechanisms ("automated grading saves 3 hours/week, personalized feedback improves engagement by 20%") |

**Dimension B: Connective Tissue** (does it explain *how/why* things work, or just list them?)

| Level | Criteria |
|-------|----------|
| Low | Only lists claims without connecting logic |
| Medium | Partial explanation of how/why — some connective tissue but gaps remain |
| High | Clear causal chains or reasoning — explains why A leads to B |

**Scoring guide:**

| Specificity | Connective Tissue | Points |
|-------------|-------------------|--------|
| Low | Low | 8 |
| Low | Medium | 14 |
| Low | High | 20 |
| Medium | Low | 16 |
| Medium | Medium | 24 |
| Medium | High | 32 |
| High | Low | 22 |
| High | Medium | 30 |
| High | High | 38 |

### 3. Kesimpulan Mandiri (Conclusion) — 0–35 pts

A "conclusion" is defined as: final sentence(s) that signal closure — no new claims introduced, clear discourse marker (e.g., *jadi/intinya/kesimpulannya/semoga bermanfaat/oke*) or equivalent closure signal.

| Range | Criteria |
|-------|----------|
| 31–35 | All three: (1) discourse marker present (jadi/intinya/kesimpulannya/semoga/oke/terima kasih), (2) final sentence has subject + predicate, (3) last word is not a conjunction or connector. |
| 21–30 | At least one of the three conditions met, but not all three. |
| 11–20 | Final sentence has subject + predicate (grammatically complete) but no discourse marker. |
| 1–10 | Final sentence is a fragment — missing subject or predicate, or ends with a conjunction (dan/atau/tapi/karena). |
| 0 | Clip cuts off mid-sentence with no closure. |

---

## Penalty Rules

These are applied as LLM judgment calls, not algorithmic detection. Anchor on the examples below.

### Penalty A: Clip ends mid-sentence — hard cap at 40 max

**Detection heuristic (LLM judgment):**
- If the final word(s) form a complete clause with terminal punctuation or natural pause → NOT mid-sentence.
- If the final word(s) clearly continue into an unfinished thought (e.g., "Jadi kita harus..." with no resolution) → mid-sentence.

**Anchoring examples:**

| Ending | Mid-sentence? | Reasoning |
|--------|---------------|-----------|
| *"...Jadi intinya, AI membantu guru."* | No | Complete clause, clear conclusion. |
| *"...Oke, itu tadi penjelasan saya."* | No | Discourse marker + complete sentence. |
| *"...Nah, kalau begitu, kita harus..."* | Yes | Unfinished clause — "kita harus" expects an object. |
| *"...Artinya hasilnya lebih baik dan"* | Yes | Conjunction "dan" with no following clause. |
| *"...Semoga bermanfaat ya."* | No | Complete pleasantry. |

### Penalty B: No identifiable problem/question in first 20% of clip — −15 pts

The first 20% of the clip (by word count) must contain an identifiable problem statement, question, or context-setting premise. If absent, deduct 15 points.

**Anchoring examples:**

| Opener | Problem in first 20%? | Reasoning |
|--------|----------------------|-----------|
| *"Banyak guru menghabiskan waktu berjam-jam untuk menilai pekerjaan siswa secara manual."* | Yes | Problem clearly stated (time waste). |
| *"Pertanyaannya, bisakah AI benar-benar menggantikan peran guru?"* | Yes | Question posed directly. |
| *"Hari ini kita akan membahas tentang AI."* | No | Topic stated, but no problem or question framed. |
| *"AI memiliki banyak manfaat yang luar biasa."* | No | Vague claim, no problem statement. |

---

## Worked Examples

### Example A: High-Scoring Clip (Score: 96/98)

**Transcript excerpt (Bahasa Indonesia):**

> "Banyak guru di Indonesia menghabiskan waktu tiga jam setiap hari untuk menilai pekerjaan siswa secara manual. Ini masalah besar yang mengurangi waktu mengajar mereka. Nah, salah satu solusinya adalah menggunakan AI untuk automated grading. Sistem AI bisa menilai pekerjaan siswa dalam hitungan detik, bukan jam. Misalnya, platform seperti Gradescope menggunakan machine learning untuk mengenali tulisan tangan dan menilai esai secara otomatis. Dampaknya signifikan — guru yang tadinya menghabiskan tiga jam untuk menilai, sekarang hanya butuh tiga puluh menit untuk review hasil AI. Jadi intinya, AI bukan menggantikan guru, tapi membantu guru menghemat waktu supaya bisa fokus pada aktivitas mengajar yang lebih penting."

**Scoring breakdown:**

| Component | Score | Reasoning |
|-----------|-------|-----------|
| Opener (0–25) | 23 | Problem clearly stated in first sentence ("tiga jam setiap hari menilai manual"). Discourse marker "Nah" transitions to solution. |
| Elaboration (0–38) | 38 | Specificity: HIGH — named platform (Gradescope), specific time comparison (3 jam → 30 menit). Connective tissue: HIGH — explains causal chain (manual grading → time waste → AI solution → specific impact). |
| Conclusion (0–35) | 35 | Discourse marker present ("Jadi intinya"), final sentence has subject + predicate, last word is not a conjunction. |
| Penalties | 0 | Problem appears at word ~2 (within first 20%). No penalty applied. |
| **Total** | **96** | |

### Example B: Low-Scoring Clip (Score: 0/98)

**Transcript excerpt (Bahasa Indonesia):**

> "Nah terus ada juga yang namanya machine learning itu bisa dipakai buat apa sih sebenarnya jadi banyak banget contohnya kayak di bidang kesehatan terus di bidang pendidikan juga ada dan yang paling menarik itu di bidang bisnis karena banyak perusahaan yang sudah pakai AI untuk"

**Scoring breakdown:**

| Component | Score | Reasoning |
|-----------|-------|-----------|
| Opener (0–25) | 5 | No problem or question framed. "Nah terus" is a casual filler, not a context-setting opener. |
| Elaboration (0–38) | 8 | Specificity: LOW — "banyak banget contohnya" with no concrete examples. Connective tissue: LOW — no explanation of how/why, just lists domains. |
| Conclusion (0–35) | 0 | Clip cuts off mid-sentence: "perusahaan yang sudah pakai AI untuk" — unfinished clause, no closure. |
| Penalties | −15 | No identifiable problem in first 20% of clip. |
| **Total** | **0** | (5 + 8 + 0 − 15 = −2, clamped to 0) |

---

## Application Rules

1. Score each component independently before summing.
2. Apply penalty rules after component scoring.
3. If a penalty triggers the hard cap (mid-sentence), the maximum possible score is 40 regardless of component totals.
4. Scores cannot go below 0 (clamp negative totals to 0).
5. All judgment calls should be anchored on the examples above. When in doubt, score conservatively.
6. This rubric is designed to be pasted into an LLM system prompt. Do not modify wording without updating the anchoring examples.
