const fs = require('node:fs');
const path = require('node:path');
const env = require('../config/env');
const AppError = require('../utils/app-error');

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
 * Melakukan parsing dan normalisasi respons mentah dari STT API (Hugging Face Whisper / OpenAI)
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

  // Jika response berupa array (format khas pipeline Hugging Face)
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

  let text = String(data?.text || data?.transcription || data?.transcript || '').trim();
  let wordList = [];

  // Format 1: Format OpenAI standar (array words)
  if (Array.isArray(data?.words) && data.words.length > 0) {
    wordList = data.words;
  }
  // Format 2: Format Hugging Face / vLLM / Elice Whisper (array chunks)
  else if (Array.isArray(data?.chunks) && data.chunks.length > 0) {
    wordList = data.chunks.map((chunk) => {
      let start = 0;
      let end = 0;
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
        word: (chunk.text || chunk.word || '').trim(),
        start,
        end,
        confidence: chunk.confidence ?? 1.0,
      };
    });
  }
  // Format 3: Format segments
  else if (Array.isArray(data?.segments) && data.segments.length > 0) {
    for (const segment of data.segments) {
      if (Array.isArray(segment.words) && segment.words.length > 0) {
        wordList.push(...segment.words);
      } else {
        // Fallback: estimasi waktu per kata dari segmen kalimat jika kata per kata tidak tersedia
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

  // Jika teks kosong tapi ada kata-kata di wordList, gabungkan jadi teks utuh
  if (!text && wordList.length > 0) {
    text = wordList.map((w) => w.word || w.text || '').filter(Boolean).join(' ').trim();
  }

  // Fallback: Jika ada teks tapi tidak ada kata di wordList sama sekali
  if (text && wordList.length === 0) {
    const tokens = text.split(/\s+/).filter(Boolean);
    const estDuration = Number(data?.duration) || tokens.length * 0.4;
    const step = estDuration / Math.max(1, tokens.length);
    wordList = tokens.map((tok, idx) => ({
      word: tok,
      start: Number((idx * step).toFixed(2)),
      end: Number(((idx + 1) * step).toFixed(2)),
      confidence: 1.0,
    }));
  }

  // Normalisasi setiap kata sesuai kontrak REQ-2.1: word, start_time, end_time, confidence
  const normalizedWords = wordList
    .map((item) => {
      const textVal = String(item.word || item.text || '').trim();
      const startVal = Number(item.start ?? item.start_time ?? (Array.isArray(item.timestamp) ? item.timestamp[0] : 0));
      const endVal = Number(item.end ?? item.end_time ?? (Array.isArray(item.timestamp) ? item.timestamp[1] : startVal));

      return {
        word: textVal,
        start_time: Number.isFinite(startVal) ? startVal : 0,
        end_time: Number.isFinite(endVal) ? endVal : (Number.isFinite(startVal) ? startVal : 0),
        confidence: typeof item.confidence === 'number' ? item.confidence : 1.0,
      };
    })
    .filter((item) => item.word.length > 0);

  // Hitung durasi total audio
  let duration = Number(data?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    if (normalizedWords.length > 0) {
      duration = normalizedWords[normalizedWords.length - 1].end_time;
    } else {
      duration = null;
    }
  }

  return {
    text: text.trim(),
    language: data?.language || 'indonesian',
    duration,
    words: normalizedWords,
    segments: Array.isArray(data?.segments) ? data.segments : [],
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
  let response;

  try {
    // Timeout 180 detik (3 menit) untuk mengantisipasi proses Whisper pada video panjang
    const timeoutSignal = AbortSignal.timeout(180000);

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
  console.log(`[STT] Response HTTP ${response.status} diterima dalam ${elapsedSec}s`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[STT API Error] HTTP ${response.status}:`, errorText);

    // Penanganan khusus status 504 (Cloudflare Gateway Timeout)
    if (response.status === 504 || errorText.toLowerCase().includes('gateway time-out') || errorText.toLowerCase().includes('gateway timeout')) {
      throw new AppError(
        504,
        'STT_GATEWAY_TIMEOUT',
        'Server STT (Elice) mengalami Gateway Timeout (504). Beban komputasi model AI melampaui batas waktu Cloudflare. Silakan coba unggah video yang lebih pendek atau coba kembali.'
      );
    }

    // Penanganan khusus status 502 (Bad Gateway)
    if (response.status === 502 || errorText.toLowerCase().includes('bad gateway')) {
      throw new AppError(
        502,
        'STT_BAD_GATEWAY',
        'Server STT (Elice) mengalami Bad Gateway (502). Layanan model origin sedang tidak tersedia atau dalam proses restart.'
      );
    }

    if (response.status === 503) {
      throw new AppError(
        503,
        'STT_SERVICE_UNAVAILABLE',
        'Layanan STT API sementara tidak dapat menerima permintaan (503 Service Unavailable).'
      );
    }

    throw new AppError(
      response.status >= 500 ? 502 : 400,
      'STT_API_ERROR',
      `Gagal mentranskripsi audio (HTTP ${response.status}): ${errorText || response.statusText}`
    );
  }

  // Respons berhasil: baca JSON mentah
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

  // Normalisasi ke format baku REQ-2.1
  const normalized = normalizeSTTResponse(parsedJson, audioFilePath);
  console.log(`[STT] Hasil parsing: ${normalized.words.length} kata terdeteksi, durasi: ${normalized.duration}s`);

  return normalized;
}

module.exports = {
  transcribeAudio,
  normalizeSTTResponse,
  sanitizeBaseUrl,
};
