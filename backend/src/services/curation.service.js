const crypto = require('node:crypto');
const { getPrisma } = require('../config/prisma');
const env = require('../config/env');
const { createChunker } = require('./chunker');
const { callChatCompletion } = require('./llm-client');
const clipOutputSchema = require('../utils/clip-output-schema');
const fallbackOutputSchema = require('../utils/fallback-output-schema');
const { parseFallback, ParseFailure } = require('./fallback_parser');

const SCORE_MAX = 98;
const MIN_CLIPS = 3;
const MAX_CLIPS = 5;
const OVERLAP_THRESHOLD = 0.5;

const chunker = createChunker({ chunkDurationSec: 300, contextPaddingSec: 30 });

function normalizeScore(rawScore) {
  return rawScore / SCORE_MAX;
}

function computeOverlap(clipA, clipB) {
  const overlapStart = Math.max(clipA.start_time_seconds, clipB.start_time_seconds);
  const overlapEnd = Math.min(clipA.end_time_seconds, clipB.end_time_seconds);
  const intersection = Math.max(0, overlapEnd - overlapStart);
  const durationA = clipA.end_time_seconds - clipA.start_time_seconds;
  const durationB = clipB.end_time_seconds - clipB.start_time_seconds;
  const union = durationA + durationB - intersection;
  return union > 0 ? intersection / union : 0;
}

function isContained(clipA, clipB) {
  return (clipA.start_time_seconds >= clipB.start_time_seconds &&
          clipA.end_time_seconds <= clipB.end_time_seconds) ||
         (clipB.start_time_seconds >= clipA.start_time_seconds &&
          clipB.end_time_seconds <= clipA.end_time_seconds);
}

function dedupClips(clips) {
  const sorted = [...clips].sort((a, b) => b.concept_score - a.concept_score);
  const kept = [];

  for (const clip of sorted) {
    const isDuplicate = kept.some(
      (existing) => isContained(clip, existing) ||
                   computeOverlap(clip, existing) >= OVERLAP_THRESHOLD
    );
    if (!isDuplicate) {
      kept.push(clip);
    }
  }

  return kept;
}

function buildPrompt(chunk) {
  const transcriptText = chunk.transcriptSlice
    .map((w) => `[${w.start_time.toFixed(2)}-${w.end_time.toFixed(2)}] ${w.word}`)
    .join(' ');

  return `Anda adalah ahli kurasi konten pendidikan. Tugas Anda adalah menemukan segmen-segmen video yang "Konsep Lengkap" (Concept Completeness) dari transkrip berikut.

ATURAN PENEMUAN CLIP:
1. Cari segmen berdurasi 25-75 detik yang merupakan unit pendidikan mandiri
2. Setiap clip harus memiliki: Pembuka Kontekstual (masalah/pertanyaan di 20% pertama), Elaborasi/Solusi (penjelasan konkret), Kesimpulan Mandiri (penutup tanpa kalimat terpotong)
3. Gunakan penanda diskursus sebagai petunjuk: "Nah", "Jadi", "Oke", "Jadi intinya", "Kesimpulannya", "Semoga"
4. Mulai clip saat topik baru dimulai; akhiri saat pembicara menutup
5. Jangan potong kalimat di tengah-tengah

RUBRIK PENILAIAN (0-98):

1. Pembuka Kontekstual (0-25 poin):
   - 21-25: Masalah/pertanyaan jelas di 20% pertama
   - 11-20: Ada pembuka tapi samar
   - 1-10: Pembuka ada tapi tidak jelas
   - 0: Tidak ada pembuka

2. Elaborasi/Solusi (0-38 poin):
   Spesifisitas × Koneksi:
   - Low×Low=8, Low×Med=14, Low×High=20
   - Med×Low=16, Med×Med=24, Med×High=32
   - High×Low=22, High×Med=30, High×High=38

3. Kesimpulan Mandiri (0-35 poin):
   - 31-35: Ada penanda diskursus + kalimat lengkap + tidak berakhir konjungsi
   - 21-30: Salah satu dari tiga syarat terpenuhi
   - 11-20: Kalimat lengkap tapi tanpa penanda diskursus
   - 1-10: Kalimat terpotong
   - 0: Clip terpotong di tengah kalimat

ATURAN KRITIS:
- JIKA clip berakhir di tengah kalimat → MAKSIMAL skor = 40
- JIKA tidak ada masalah/pertanyaan di 20% pertama → kurangi 15 poin

Output harus berupa JSON valid dengan format:
{
  "segments": [
    {
      "start_time_seconds": <number>,
      "end_time_seconds": <number>,
      "duration": <number, 25-75>,
      "concept_score": <integer, 0-98>,
      "suggested_title": "<string>",
      "pedagogical_reason": "<string, max 280 karakter>"
    }
  ]
}

Jika tidak ada segmen yang memenuhi kriteria, kembalikan: {"segments": []}

Transkrip:
${transcriptText}`;
}

async function defaultCallLlm(prompt) {
  return callChatCompletion(prompt);
}

function parseLlmResponse(rawResponse) {
  try {
    const parsed = JSON.parse(rawResponse);
    const validation = clipOutputSchema.validate(parsed, { abortEarly: false });
    if (!validation.error) {
      return { success: true, data: validation.value };
    }
  } catch (e) {
    // JSON parse failed, try fallback
  }

  const fallbackResult = parseFallback(rawResponse);
  if (fallbackResult instanceof ParseFailure) {
    return { success: false, error: fallbackResult.error };
  }

  const validation = fallbackOutputSchema.validate(fallbackResult, { abortEarly: false });
  if (!validation.error) {
    return { success: true, data: validation.value, isFallback: true };
  }

  return { success: false, error: 'Validation failed for both main and fallback schemas' };
}

async function insertClips(prisma, projectId, segments, isFallback) {
  const clips = [];

  for (const segment of segments) {
    const clipId = crypto.randomUUID();
    const normalizedScore = segment.concept_score !== null
      ? normalizeScore(segment.concept_score)
      : null;

    const clip = await prisma.clip.create({
      data: {
        id: clipId,
        projectId,
        title: segment.suggested_title,
        startTime: segment.start_time_seconds,
        endTime: segment.end_time_seconds,
        transcriptJson: segment,
        conceptScore: normalizedScore,
        pedagogicalReason: segment.pedagogical_reason || 'Memerlukan review',
        status: isFallback || segment.concept_score === null ? 'needs_review' : 'pending',
      },
    });

    clips.push({
      ...clip,
      start_time_seconds: segment.start_time_seconds,
      end_time_seconds: segment.end_time_seconds,
      concept_score: segment.concept_score,
    });
  }

  return clips;
}

async function curateClips(projectId, transcript, { callLlm = defaultCallLlm } = {}) {
  const prisma = getPrisma();

  const chunks = chunker(transcript);
  if (chunks.length === 0) {
    throw new Error('Transcript too short for chunking');
  }

  const allClips = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prompt = buildPrompt(chunk);
    const callStart = Date.now();

    let rawResponse;
    let usage = { inputTokens: 0, outputTokens: 0 };
    let retryCount = 0;

    try {
      const llmResult = await callLlm(prompt);
      if (typeof llmResult === 'string') {
        rawResponse = llmResult;
      } else {
        rawResponse = llmResult.text;
        usage = llmResult.usage || usage;
        retryCount = llmResult.retryCount || 0;
      }
    } catch (err) {
      const latencyMs = Date.now() - callStart;
      await prisma.llmCall.create({
        data: {
          projectId,
          chunkIndex: i,
          model: env.llmModel || 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs,
          success: false,
          errorCode: err.code || 'UNKNOWN',
          retryCount: 0,
        },
      });
      throw err;
    }

    const latencyMs = Date.now() - callStart;
    const result = parseLlmResponse(rawResponse);

    await prisma.llmCall.create({
      data: {
        projectId,
        chunkIndex: i,
        model: env.llmModel || 'unknown',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs,
        success: result.success,
        errorCode: result.success ? null : 'PARSE_FAILED',
        retryCount,
      },
    });

    if (result.success && result.data.segments.length > 0) {
      const clips = await insertClips(
        prisma,
        projectId,
        result.data.segments,
        result.isFallback || false
      );
      allClips.push(...clips);
    }
  }

  const dedupedClips = dedupClips(allClips);

  if (dedupedClips.length < MIN_CLIPS) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'error', processingStage: 'analyze' },
    });
    throw new Error(
      `Kurasi gagal: hanya ${dedupedClips.length} klip ditemukan (minimal ${MIN_CLIPS})`
    );
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'idle', processingStage: null },
  });

  return dedupedClips;
}

module.exports = { curateClips, dedupClips, normalizeScore, computeOverlap, buildPrompt, parseLlmResponse };
