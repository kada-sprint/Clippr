# C3: Living and Beyond — Kesiapan untuk User Testing

**Tanggal:** 2026-09-10
**Status:** Implementasi selesai, menunggu verifikasi end-to-end

---

## Ringkasan yang Sudah Dilakukan

### 1. Live LLM API Integration (RFC-C3-01)

**Perubahan:**
- `backend/src/config/env.js` — env vars `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`
- `backend/.env.example` — dokumentasi LLM config
- `backend/src/services/llm-client.js` — module baru: OpenAI client, retry/backoff, timeout 35s, error handling
- `backend/src/services/curation.service.js` — `defaultCallLlm` stub diganti dengan real call, logging ke `llm_calls`
- `backend/prisma/schema.prisma` — model `LlmCall` + relation ke `Project`

**Yang perlu dilakukan:**
1. Database migration:
   ```bash
   cd backend && npx prisma migrate dev --name add_llm_calls
   ```
2. Tambahkan `LLM_API_KEY` ke `backend/.env`
3. Jalankan smoke test:
   ```bash
   cd backend && node scripts/smoke-test-llm.js
   ```
4. Jalankan semua test:
   ```bash
   cd backend && npm test
   ```

### 2. Stress-Test Fallback Parser (RFC-C3-02)

**Perubahan:**
- `backend/tests/fallback_stress.test.js` — test baru: truncated JSON, prose-wrapped JSON, retry logic

**Yang perlu dilakukan:**
1. Jalankan stress test:
   ```bash
   cd backend && npx node --test tests/fallback_stress.test.js
   ```
2. Review `tests/fixtures/real_malformed_samples.json` untuk failure modes yang ditemukan

### 3. Cek NFR-1 Benchmark Data

**Query untuk melihat data:**
```sql
SELECT chunk_index, model, input_tokens, output_tokens, 
       latency_ms, success, error_code, created_at 
FROM llm_calls 
ORDER BY created_at DESC;
```

**Metrik NFR-1:**
- Total tokens: `SELECT SUM(input_tokens + output_tokens) FROM llm_calls`
- Rata-rata latency: `SELECT AVG(latency_ms) FROM llm_calls`
- Max latency: `SELECT MAX(latency_ms) FROM llm_calls`

---

## Kriteria Keberhasilan (Acceptance Criteria)

### RFC-C3-01

| AC | Kriteria | Cara Verifikasi |
|---|---|---|
| AC1 | Berhasil return real output untuk `sample_transcript_mock.json` | Smoke test print segments dengan scores |
| AC2 | Simulated timeout/429 trigger retry, bukan crash | Stress test "retry logic" passed |
| AC3 | Latency dan token counts logged per call | Query `llm_calls` table |
| AC4 | API key tidak pernah di-commit atau di-print | `.env` gitignored |

### RFC-C3-02

| AC | Kriteria | Cara Verifikasi |
|---|---|---|
| AC1 | Semua real malformed samples ditangani tanpa exception | Stress test truncated + prose-wrapped passed |
| AC2 | Minimal 1 failure mode baru ditemukan dan didokumentasi | `real_malformed_samples.json` |

---

## Keputusan Selama Grilling Session

| Keputusan | Pilihan |
|---|---|
| RFC mapping | Ganti `defaultCallLlm` stub, tanpa module `prompt_runner` baru (ADR-0002 dipertahankan) |
| LLM client | Module baru `llm-client.js` |
| Provider env vars | `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` (terpisah dari STT) |
| Provider access | OpenAI-compatible (mlapi.run untuk GPT-5.6 Luna) |
| Model | GPT-5.6 Luna (`gpt-5.6-luna`) |
| Retry | Custom implementation, max 3 retries, exponential backoff |
| Timeout | `AbortSignal.timeout(35000)` — native Node 22 |
| JSON enforcement | OpenAI JSON mode (`response_format: { type: "json_object" }`) |
| Error handling | `AppError` dengan codes: `LLM_TIMEOUT`, `LLM_AUTH_FAILED`, `LLM_UNREACHABLE` |
| Token/latency storage | Tabel `llm_calls` di Prisma |
| Injectable pattern | Pertahankan parameter `callLlm` pada `curateClips()` |
| Fallback parser stress test | Truncation via `max_completion_tokens` + JSON mode disabled |

---

## File yang Diubah/Dibuat

| File | Aksi |
|---|---|
| `backend/src/config/env.js` | Ditambah `llmApiKey`, `llmApiBaseUrl`, `llmModel` |
| `backend/.env.example` | Ditambah LLM env vars |
| `backend/src/services/llm-client.js` | **Baru** — OpenAI client, retry, timeout, error handling |
| `backend/src/services/curation.service.js` | Ganti `defaultCallLlm` stub, tambah logging `llm_calls` |
| `backend/prisma/schema.prisma` | Tambah model `LlmCall` + relation ke Project |
| `backend/scripts/smoke-test-llm.js` | **Baru** — smoke test untuk LLM client |
| `backend/tests/fallback_stress.test.js` | **Baru** — stress test RFC-C3-02 |

---

## Kode yang Tidak Berubah

- `curation.service.js` — `curateClips()` signature tetap sama (injectable `callLlm`)
- `fallback_parser.js` — Tidak ada perubahan
- `dry_run.test.js` — Semua test existing masih pass
- `curation.service.test.js` — Tidak ada perubahan
- ADR-0002 — Keputusan injectable `callLlm` masih valid

---

## Risiko & Catatan

1. **JSON mode dengan model lain** — Beberapa model mungkin tidak support `response_format: { type: "json_object" }`. Fallback parser tetap jadi safety net.
2. **Rate limiting** — `retryAfter` header dari provider belum di-test secara real. Exponential backoff default (1s, 2s, 4s) harusnya cukup untuk MVP.
3. **`llm_calls` logging hanya di `curateClips`** — Smoke test tidak log ke DB karena langsung panggil `callChatCompletion`. Logging ke DB terjadi saat pipeline end-to-end berjalan.
4. **Model-specific quirks** — GPT-5.6 Luna via mlapi.run: tidak support `temperature` custom, hanya `max_completion_tokens` (bukan `max_tokens`). Perlu dicek jika ganti model/provider.
