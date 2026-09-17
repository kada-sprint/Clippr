const crypto = require('node:crypto');
const { getPrisma } = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/app-error');
const { createChunker } = require('./chunker');
const { callChatCompletion } = require('./llm-client');
const clipOutputSchema = require('../utils/clip-output-schema');
const fallbackOutputSchema = require('../utils/fallback-output-schema');
const { parseFallback, ParseFailure } = require('./fallback_parser');

const SCORE_MAX = 98;
const MIN_CLIPS = 1;
const MAX_CLIPS = 5;
const OVERLAP_THRESHOLD = 0.5;

const chunker = createChunker({ chunkDurationSec: 300, contextPaddingSec: 30 });

function normalizeScore(rawScore) {
  return rawScore / SCORE_MAX;
}

function computeOverlap(clipA, clipB) {
  const overlapStart = Math.max(clipA.startTime, clipB.startTime);
  const overlapEnd = Math.min(clipA.endTime, clipB.endTime);
  const intersection = Math.max(0, overlapEnd - overlapStart);
  const durationA = clipA.endTime - clipA.startTime;
  const durationB = clipB.endTime - clipB.startTime;
  const union = durationA + durationB - intersection;
  return union > 0 ? intersection / union : 0;
}

function isContained(clipA, clipB) {
  return (clipA.startTime >= clipB.startTime &&
          clipA.endTime <= clipB.endTime) ||
         (clipB.startTime >= clipA.startTime &&
          clipB.endTime <= clipA.endTime);
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

async function insertClips(prisma, projectId, segments, transcriptWords, isFallback) {
  const clips = [];

  for (const segment of segments) {
    const clipId = crypto.randomUUID();
    const normalizedScore = segment.concept_score !== null
      ? normalizeScore(segment.concept_score)
      : null;

    const clipStart = segment.start_time_seconds;
    const clipEnd = segment.end_time_seconds;

    const wordsForClip = (transcriptWords || [])
      .filter((w) => w.start_time >= clipStart && w.start_time < clipEnd)
      .map((w) => ({
        word: w.word,
        start_time: Number((w.start_time - clipStart).toFixed(2)),
        end_time: Number((w.end_time - clipStart).toFixed(2)),
        confidence: w.confidence,
      }));

    const clip = await prisma.clip.create({
      data: {
        id: clipId,
        projectId,
        title: segment.suggested_title,
        startTime: clipStart,
        endTime: clipEnd,
        transcriptJson: {
          words: wordsForClip,
          text: wordsForClip.map((w) => w.word).join(' '),
          segment: {
            start_time_seconds: clipStart,
            end_time_seconds: clipEnd,
            duration: segment.duration,
            concept_score: segment.concept_score,
            suggested_title: segment.suggested_title,
            pedagogical_reason: segment.pedagogical_reason,
          },
        },
        conceptScore: normalizedScore,
        pedagogicalReason: segment.pedagogical_reason || 'Memerlukan review',
        status: isFallback || segment.concept_score === null ? 'needs_review' : 'pending',
      },
    });

    clips.push({
      ...clip,
      concept_score: segment.concept_score,
    });
  }

  return clips;
}

async function curateClips(projectId, transcript, { callLlm = defaultCallLlm,
  recordLlmCall = (data) => getPrisma().llmCall.create({ data }),
} = {}) {

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
      await recordLlmCall({
        projectId,
        chunkIndex: i,
        model: env.llmModel || 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        success: false,
        errorCode: err.code || 'UNKNOWN',
        retryCount: 0,
      });
      throw err;
    }

    const latencyMs = Date.now() - callStart;
    const result = parseLlmResponse(rawResponse);

    await recordLlmCall({
      projectId,
      chunkIndex: i,
      model: env.llmModel || 'unknown',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs,
      success: result.success,
      errorCode: result.success ? null : 'PARSE_FAILED',
      retryCount,
    });

    if (!result.success) throw new AppError(422, 'CURATION_INVALID', 'Keluaran kurasi tidak valid.');
    allClips.push(...result.data.segments.map((segment) => ({
      ...segment, startTime: segment.start_time_seconds, endTime: segment.end_time_seconds,
    })));
  }

  const dedupedClips = dedupClips(allClips.filter((segment) =>
    Number.isFinite(segment.concept_score) && segment.concept_score >= 0 && segment.concept_score <= SCORE_MAX &&
    Number.isFinite(segment.startTime) && segment.startTime >= 0 &&
    Number.isFinite(segment.endTime) &&
    segment.endTime <= (transcript.duration || transcript.words.at(-1)?.end_time) &&
    segment.endTime - segment.startTime >= 25 && segment.endTime - segment.startTime <= 75
  )).slice(0, MAX_CLIPS);
  if (dedupedClips.length < MIN_CLIPS) {
    throw new AppError(422, 'CURATION_INSUFFICIENT', `Kurasi menghasilkan kurang dari ${MIN_CLIPS} klip valid.`);
  }

  return dedupedClips;
}

module.exports = { insertClips, curateClips, dedupClips, normalizeScore, computeOverlap, buildPrompt, parseLlmResponse };
