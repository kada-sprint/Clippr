const fs = require('node:fs');
const path = require('node:path');
const env = require('../config/env');
const AppError = require('../utils/app-error');
const { getAudioDuration, splitAudioChunk } = require('../utils/ffmpeg');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000;
const TIMEOUT_MS = 180_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sanitasi Base URL agar selalu berformat http(s)://.../v1
 * Mencegah kesalahan input jika pengguna menempelkan URL endpoint lengkap
 */
function sanitizeBaseUrl(inputUrl) {
  if (!inputUrl) return 'https://api.openai.com/v1';
  let url = inputUrl.trim().replace(/\/+$/, '');
  // Bersihkan jika pengguna menempelkan endpoint path lengkap /audio/transcriptions
  url = url.replace(/\/audio\/transcriptions\/?$/, '');
  // Pastikan berakhiran /v1 jika belum ada
  if (!url.endsWith('/v1')) {
    url = `${url}/v1`;
  }
  return url;
}

/**
 * Melakukan parsing dan normalisasi respons mentah dari STT API (Elice API / Hugging Face Whisper / OpenAI)
 * Menjamin kepatuhan REQ-2.1 (Word-Level Timestamps: word, start_time, end_time, confidence)
 * @param {any} raw - Respons mentah (JSON objek, array, atau string) dari server STT
 * @param {string} [audioFilePath=''] - Path audio lokal untuk referensi
 * @returns {Object} Struktur baku transcriptJson
 */
function normalizeSTTResponse(raw, audioFilePath = '') {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = { text: data };
    }
  }

  // Jika response berupa array
  if (Array.isArray(data)) {
    data = data[0] || {};
  }

  // Unwrap jika respons dibungkus dalam data, result, dsb.
  if (data && typeof data === 'object') {
    if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      data = data.data;
    } else if (data.result && typeof data.result === 'object' && !Array.isArray(data.result)) {
      data = data.result;
    }
  }

  // Elice API membungkus hasil transkripsi di dalam objek `transcript`:
  // { "_result": { "status": "ok" }, "transcript": { "text": "...", "words": [...] } }
  const transcriptObj = (data?.transcript && typeof data.transcript === 'object' && !Array.isArray(data.transcript))
    ? data.transcript
    : null;

  // 1. Ekstraksi String Text Murni (Pastikan string murni, bukan object/array atau "[object Object]")
  let rawTextCandidate = '';
  if (typeof transcriptObj?.text === 'string' && transcriptObj.text.trim()) {
    rawTextCandidate = transcriptObj.text;
  } else if (typeof data?.text === 'string' && data.text.trim()) {
    rawTextCandidate = data.text;
  } else if (typeof transcriptObj?.transcription === 'string' && transcriptObj.transcription.trim()) {
    rawTextCandidate = transcriptObj.transcription;
  } else if (typeof data?.transcription === 'string' && data.transcription.trim()) {
    rawTextCandidate = data.transcription;
  } else if (typeof data?.transcript === 'string' && data.transcript.trim()) {
    rawTextCandidate = data.transcript;
  }

  let text = rawTextCandidate.trim();
  let wordList = [];

  // 2. Ekstraksi Array Words (REQ-2.1)
  // Cek transcript.words (Elice API), data.words (OpenAI), data.chunks (Hugging Face), segments
  let rawWordsArray = null;
  if (Array.isArray(transcriptObj?.words) && transcriptObj.words.length > 0) {
    rawWordsArray = transcriptObj.words;
  } else if (Array.isArray(data?.words) && data.words.length > 0) {
    rawWordsArray = data.words;
  }

  if (rawWordsArray) {
    wordList = rawWordsArray.map((item) => {
      if (typeof item === 'string') {
        return { word: item.trim(), start: null, end: null, confidence: 1.0 };
      }
      const wordText = String(item?.word || item?.text || '').trim();
      let start = item?.start ?? item?.start_time;
      let end = item?.end ?? item?.end_time;
      if (Array.isArray(item?.timestamp)) {
        start = item.timestamp[0];
        end = item.timestamp[1];
      }
      return {
        word: wordText,
        start: Number.isFinite(Number(start)) ? Number(start) : null,
        end: Number.isFinite(Number(end)) ? Number(end) : null,
        confidence: typeof item?.confidence === 'number' ? item.confidence : 1.0,
      };
    });
  }
  // Format Chunks (Hugging Face)
  else if (Array.isArray(transcriptObj?.chunks || data?.chunks)) {
    const chunks = transcriptObj?.chunks || data?.chunks;
    wordList = chunks.map((chunk) => {
      let start = null;
      let end = null;
      if (Array.isArray(chunk.timestamp)) {
        start = chunk.timestamp[0] ?? 0;
        end = chunk.timestamp[1] ?? start;
      } else if (chunk.timestamp && typeof chunk.timestamp === 'object') {
        start = chunk.timestamp.start ?? 0;
        end = chunk.timestamp.end ?? start;
      } else {
        start = chunk.start ?? chunk.start_time ?? 0;
        end = chunk.end ?? chunk.end_time ?? start;
      }
      return {
        word: String(chunk.text || chunk.word || '').trim(),
        start: Number.isFinite(Number(start)) ? Number(start) : null,
        end: Number.isFinite(Number(end)) ? Number(end) : null,
        confidence: chunk.confidence ?? 1.0,
      };
    });
  }
  // Format Segments (Whisper segments)
  else if (Array.isArray(transcriptObj?.segments || data?.segments)) {
    const segments = transcriptObj?.segments || data?.segments;
    for (const segment of segments) {
      if (Array.isArray(segment.words) && segment.words.length > 0) {
        wordList.push(...segment.words);
      } else {
        const segText = String(segment.text || '').trim();
        const tokens = segText.split(/\s+/).filter(Boolean);
        const segStart = Number(segment.start ?? 0);
        const segEnd = Number(segment.end ?? segStart + tokens.length * 0.4);
        const segDuration = Math.max(0.1, segEnd - segStart);
        const step = segDuration / Math.max(1, tokens.length);

        tokens.forEach((w, idx) => {
          wordList.push({
            word: w,
            start: Number((segStart + idx * step).toFixed(2)),
            end: Number((segStart + (idx + 1) * step).toFixed(2)),
            confidence: 1.0,
          });
        });
      }
    }
  }

  // Jika teks masih kosong tapi ada kata di wordList, susun teks dari kata
  if (!text && wordList.length > 0) {
    text = wordList.map((w) => w.word || w.text || '').filter(Boolean).join(' ').trim();
  }

  // Fallback: Jika ada teks tapi tidak ada kata di wordList, lakukan split proporsional
  if (text && wordList.length === 0) {
    const tokens = text.split(/\s+/).filter((tok) => tok && tok !== '[object' && tok !== 'Object]');
    const estDuration = Number(transcriptObj?.duration || data?.duration) || (tokens.length * 0.4);
    const step = estDuration / Math.max(1, tokens.length);
    wordList = tokens.map((tok, idx) => ({
      word: tok,
      start: Number((idx * step).toFixed(2)),
      end: Number(((idx + 1) * step).toFixed(2)),
      confidence: 1.0,
    }));
  }

  // 3. Normalisasi setiap kata sesuai kontrak REQ-2.1: { word, start_time, end_time, confidence }
  const normalizedWords = wordList
    .map((item, idx) => {
      const rawWord = String(item.word || item.text || '').trim();
      // Cegah kebocoran string [object Object]
      const wordText = (rawWord === '[object Object]' || rawWord === '[object' || rawWord === 'Object]')
        ? ''
        : rawWord;

      let startVal = Number(item.start ?? item.start_time ?? (Array.isArray(item.timestamp) ? item.timestamp[0] : null));
      let endVal = Number(item.end ?? item.end_time ?? (Array.isArray(item.timestamp) ? item.timestamp[1] : null));

      // Jika start atau end tidak valid, gunakan estimasi urutan
      if (!Number.isFinite(startVal)) {
        startVal = Number((idx * 0.4).toFixed(2));
      }
      if (!Number.isFinite(endVal) || endVal < startVal) {
        endVal = Number((startVal + 0.35).toFixed(2));
      }

      return {
        word: wordText,
        start_time: startVal,
        end_time: endVal,
        confidence: typeof item.confidence === 'number' && Number.isFinite(item.confidence) ? item.confidence : 1.0,
      };
    })
    .filter((item) => item.word.length > 0);

  // Hitung durasi total audio
  let duration = Number(transcriptObj?.duration || data?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    if (normalizedWords.length > 0) {
      duration = normalizedWords[normalizedWords.length - 1].end_time;
    } else {
      duration = null;
    }
  }

  return {
    text: text,
    language: transcriptObj?.language || data?.language || 'indonesian',
    duration,
    words: normalizedWords,
    segments: Array.isArray(transcriptObj?.segments || data?.segments) ? (transcriptObj?.segments || data?.segments) : [],
    audioPath: audioFilePath ? audioFilePath.replaceAll('\\', '/') : '',
  };
}

/**
 * Layanan Speech-to-Text (STT) untuk mentranskripsi file audio menjadi teks dengan Word-Level Timestamps
 * Menggunakan FormData & Fetch yang teruji kompatibel dengan endpoint Elice Model Library (FastAPI / Hugging Face Whisper)
 * @param {string} audioFilePath - Path lokal file audio (MP3/WAV) yang akan ditranskripsikan
 * @param {string} [customVocabulary=''] - Kosakata istilah khusus (maks 20 kata) sebagai hint/prompt (REQ-2.2)
 * @returns {Promise<Object>} JSON hasil transkripsi lengkap (REQ-2.1)
 */
async function transcribeAudio(audioFilePath, customVocabulary = '') {
  if (!audioFilePath || !fs.existsSync(audioFilePath)) {
    throw new AppError(400, 'AUDIO_FILE_NOT_FOUND', 'File audio untuk transkripsi tidak ditemukan di server.');
  }

  const apiKey = env.eliceApiKey || process.env.ELICE_API_KEY || process.env.OPENAI_API_KEY;
  const rawBaseURL = env.eliceApiBaseUrl || process.env.ELICE_API_BASE_URL || process.env.OPENAI_BASE_URL;
  const model = env.sttModel || process.env.STT_MODEL || 'whisper-large-v3';

  if (!apiKey) {
    throw new AppError(
      503,
      'STT_NOT_CONFIGURED',
      'API Key STT belum dikonfigurasi. Harap isi ELICE_API_KEY di file .env.'
    );
  }

  const targetBase = sanitizeBaseUrl(rawBaseURL);
  const endpoint = `${targetBase}/audio/transcriptions`;

  // Baca file audio ke buffer
  const audioBuffer = await fs.promises.readFile(audioFilePath);
  const ext = path.extname(audioFilePath).toLowerCase();
  const mimeType = ext === '.mp3' ? 'audio/mpeg' : (ext === '.wav' ? 'audio/wav' : 'application/octet-stream');
  const filename = path.basename(audioFilePath);
  const audioBlob = new Blob([audioBuffer], { type: mimeType });

  console.log(`[STT] Mempersiapkan pengiriman audio: ${filename} (${(audioBuffer.length / 1024).toFixed(1)} KB) ke ${endpoint}`);

  // Susun payload FormData sesuai arahan mentor & dokumentasi Elice
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('model', model);
  formData.append('language', 'indonesian');
  formData.append('return_timestamps', 'word');

  // Kirim custom vocabulary ke parameter prompt (REQ-2.2)
  if (customVocabulary && String(customVocabulary).trim()) {
    formData.append('prompt', String(customVocabulary).trim());
    console.log(`[STT] Menyertakan custom vocabulary prompt: "${String(customVocabulary).trim()}"`);
  }

  const startTime = Date.now();
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;

    try {
      const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          accept: 'application/json',
        },
        body: formData,
        signal: timeoutSignal,
      });
    } catch (networkError) {
      if (networkError.name === 'TimeoutError' || networkError.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          console.log(`[STT] Timeout pada percobaan ${attempt + 1}/${MAX_RETRIES + 1}, mencoba ulang...`);
          await delay(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw new AppError(
          504,
          'STT_GATEWAY_TIMEOUT',
          'Permintaan ke STT API memakan waktu lebih dari 3 menit (Timeout). Silakan gunakan cuplikan video yang lebih pendek.'
        );
      }
      throw new AppError(
        502,
        'STT_NETWORK_ERROR',
        `Tidak dapat terhubung ke server STT API (${networkError.message}). Periksa koneksi internet server backend.`
      );
    }

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[STT] Response HTTP ${response.status} diterima dalam ${elapsedSec}s (percobaan ${attempt + 1})`);

    if (response.ok) {
      const rawText = await response.text();
      console.log(`[STT] Raw response size: ${rawText.length} bytes`);
      console.log(`[STT] Raw response preview: ${rawText.slice(0, 300)}`);

      let parsedJson;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[STT] Response bukan JSON valid, menggunakan teks mentah:', parseErr.message);
        parsedJson = { text: rawText };
      }

      const normalized = normalizeSTTResponse(parsedJson, audioFilePath);
      console.log(`[STT] Hasil parsing: ${normalized.words.length} kata terdeteksi, durasi: ${normalized.duration}s`);
      console.log(`[STT] Text preview: "${normalized.text.slice(0, 150)}..."`);
      return normalized;
    }

    const errorText = await response.text().catch(() => '');
    console.error(`[STT API Error] HTTP ${response.status}:`, errorText);

    lastError = { status: response.status, text: errorText };

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      const retryAfter = response.headers?.get('retry-after');
      const waitMs = retryAfter
        ? Math.max(parseInt(retryAfter, 10) * 1000, BASE_DELAY_MS)
        : BASE_DELAY_MS * Math.pow(2, attempt);
      console.log(`[STT] Retryable error ${response.status}, mencoba ulang dalam ${waitMs / 1000}s...`);
      await delay(waitMs);
      continue;
    }

    if (response.status === 504 || errorText.includes('gateway time-out') || errorText.includes('gateway timeout')) {
      throw new AppError(504, 'STT_GATEWAY_TIMEOUT',
        'Server STT (Elice) mengalami Gateway Timeout (504). Silakan coba unggah video yang lebih pendek atau coba kembali.');
    }
    if (response.status === 502 || errorText.includes('bad gateway')) {
      throw new AppError(502, 'STT_BAD_GATEWAY',
        'Server STT (Elice) mengalami Bad Gateway (502). Layanan model origin sedang tidak tersedia.');
    }
    if (response.status === 503) {
      throw new AppError(503, 'STT_SERVICE_UNAVAILABLE',
        'Layanan STT API sementara tidak dapat menerima permintaan (503).');
    }

    throw new AppError(
      response.status >= 500 ? 502 : 400,
      'STT_API_ERROR',
      `Gagal mentranskripsi audio (HTTP ${response.status}): ${errorText || response.statusText}`
    );
  }

  throw new AppError(
    lastError?.status >= 500 ? 502 : 400,
    'STT_API_ERROR',
    `Gagal mentranskripsi audio setelah ${MAX_RETRIES + 1} percobaan: ${lastError?.text || 'unknown error'}`
  );
}

const CHUNK_DURATION_SEC = 120; // 2 minutes per chunk

/**
 * Transkripsi audio dengan chunking otomatis untuk video panjang.
 * Jika audio <= CHUNK_DURATION_SEC, gunakan transcribeAudio langsung.
 * Jika lebih panjang, potong menjadi beberapa chunk, transkripsikan tiap chunk,
 * dan gabungkan hasilnya. Chunk yang gagal dilewati (partial failure).
 * @param {string} audioFilePath - Path file audio
 * @param {string} [customVocabulary=''] - Kosakata kustom
 * @param {Object} [options]
 * @param {number} [options.chunkDurationSec=120] - Durasi per chunk dalam detik (default 120s / 2 menit)
 * @returns {Promise<Object>} Transcript digabung
 */
async function transcribeAudioChunked(audioFilePath, customVocabulary = '', { chunkDurationSec = CHUNK_DURATION_SEC } = {}) {
  if (!audioFilePath || !fs.existsSync(audioFilePath)) {
    throw new AppError(400, 'AUDIO_FILE_NOT_FOUND', 'File audio untuk transkripsi tidak ditemukan di server.');
  }

  let duration;
  try {
    duration = await getAudioDuration(audioFilePath);
  } catch (err) {
    console.warn(`[STT Chunked] Gagal mendapatkan durasi, mencoba transkripsi langsung: ${err.message}`);
    return transcribeAudio(audioFilePath, customVocabulary);
  }

  console.log(`[STT Chunked] Durasi audio: ${duration.toFixed(1)}s, chunk size: ${chunkDurationSec}s`);

  // Audio pendek, transkripsi langsung tanpa chunking
  if (duration <= chunkDurationSec) {
    return transcribeAudio(audioFilePath, customVocabulary);
  }

  let chunkCount = Math.ceil(duration / chunkDurationSec);
  // Keep sub-second codec padding/tails with the previous chunk instead of
  // submitting an almost empty ASR request. Preserve the entire source duration.
  if (chunkCount > 1 && duration - (chunkCount - 1) * chunkDurationSec < 1) chunkCount--;
  console.log(`[STT Chunked] Memecah menjadi ${chunkCount} chunk`);

  const chunkResults = [];
  const tempChunkPaths = [];

  try {
    for (let i = 0; i < chunkCount; i++) {
      const startSec = i * chunkDurationSec;
      const thisDuration = i === chunkCount - 1 ? duration - startSec : chunkDurationSec;
      const offsetSec = startSec; // Timestamp offset for merging

      let chunkPath;
      try {
        chunkPath = await splitAudioChunk(audioFilePath, startSec, thisDuration);
        tempChunkPaths.push(chunkPath);
      } catch (err) {
        console.error(`[STT Chunked] Gagal memotong chunk ${i + 1}/${chunkCount}: ${err.message}`);
        throw err;
      }

      try {
        console.log(`[STT Chunked] Transkripsi chunk ${i + 1}/${chunkCount} (offset ${offsetSec.toFixed(1)}s, durasi ${thisDuration.toFixed(1)}s)`);
        const result = await transcribeAudio(chunkPath, customVocabulary);
        chunkResults.push({ result, offsetSec });
        console.log(`[STT Chunked] Chunk ${i + 1}/${chunkCount} berhasil: ${result.words?.length || 0} kata`);
      } catch (err) {
        console.error(`[STT Chunked] Chunk ${i + 1}/${chunkCount} gagal setelah retry: ${err.message}`);
        throw err; // Never checkpoint an incomplete source transcript.
      } finally {
        // Langsung hapus file temporer dari os.tmpdir() segera setelah transkripsi chunk selesai/gagal
        try {
          if (fs.existsSync(chunkPath)) {
            fs.unlinkSync(chunkPath);
          }
        } catch {}
      }
    }
  } finally {
    // Pastikan seluruh file potongan chunk dibersihkan dari os.tmpdir()
    for (const p of tempChunkPaths) {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      } catch {}
    }
  }

  if (chunkResults.length === 0) {
    throw new AppError(502, 'STT_ALL_CHUNKS_FAILED', 'Semua chunk transkripsi gagal. Periksa koneksi ke STT API.');
  }

  // Merge results
  console.log(`[STT Chunked] Menggabungkan ${chunkResults.length}/${chunkCount} chunk yang berhasil`);
  return mergeChunkResults(chunkResults);
}

/**
 * Menggabungkan hasil transkripsi dari beberapa chunk
 * @param {Array<{result: Object, offsetSec: number}>} chunkResults
 * @returns {Object} Transcript gabungan (REQ-2.1)
 */
function mergeChunkResults(chunkResults) {
  // Urutkan berdasarkan offset agar teks dan kata kronologis
  chunkResults.sort((a, b) => a.offsetSec - b.offsetSec);

  const allWords = [];
  let fullText = '';
  let lastEndTime = 0;

  for (const { result, offsetSec } of chunkResults) {
    if (Array.isArray(result?.words) && result.words.length > 0) {
      for (const word of result.words) {
        const rawWord = String(word.word || '').trim();
        // Filter artefak yang tidak valid
        if (!rawWord || rawWord === '[object Object]' || rawWord === '[object' || rawWord === 'Object]') {
          continue;
        }

        allWords.push({
          word: rawWord,
          start_time: Number((Number(word.start_time) + offsetSec).toFixed(2)),
          end_time: Number((Number(word.end_time) + offsetSec).toFixed(2)),
          confidence: typeof word.confidence === 'number' && Number.isFinite(word.confidence) ? word.confidence : 1.0,
        });
      }
    }

    if (typeof result?.text === 'string' && result.text.trim()) {
      const cleanText = result.text.trim();
      fullText = fullText ? `${fullText} ${cleanText}` : cleanText;
    }

    if (Number.isFinite(result?.duration) && result.duration > 0) {
      lastEndTime = Math.max(lastEndTime, offsetSec + result.duration);
    }
  }

  // Urutkan kata berdasarkan start_time
  allWords.sort((a, b) => a.start_time - b.start_time);

  // Jika fullText masih kosong namun words ada, susun teks dari kata-kata
  if (!fullText && allWords.length > 0) {
    fullText = allWords.map((w) => w.word).join(' ').trim();
  }

  const finalDuration = lastEndTime > 0
    ? Number(lastEndTime.toFixed(2))
    : (allWords.length > 0 ? allWords[allWords.length - 1].end_time : null);

  return {
    text: fullText,
    language: chunkResults[0]?.result?.language || 'indonesian',
    duration: finalDuration,
    words: allWords,
    segments: [],
    audioPath: chunkResults[0]?.result?.audioPath || '',
  };
}

module.exports = {
  transcribeAudio,
  transcribeAudioChunked,
  normalizeSTTResponse,
  sanitizeBaseUrl,
};
