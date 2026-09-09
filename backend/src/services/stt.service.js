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
  // Bersihkan jika pengguna tidak sengaja menempelkan path /audio/transcriptions
  url = url.replace(/\/audio\/transcriptions\/?$/, '');
  // Pastikan berakhiran /v1 jika belum ada
  if (!url.endsWith('/v1')) {
    url = `${url}/v1`;
  }
  return url;
}

/**
 * Helper untuk mendapatkan instance OpenAI Client
 * Mendukung endpoint OpenAI standar maupun Model Library dari Elice (baseURL kustom)
 */
function getOpenAIClient() {
  const apiKey = env.eliceApiKey || process.env.ELICE_API_KEY || process.env.OPENAI_API_KEY;
  const rawBaseURL = env.eliceApiBaseUrl || process.env.ELICE_API_BASE_URL || process.env.OPENAI_BASE_URL;

  if (!apiKey) {
    throw new AppError(
      503,
      'STT_NOT_CONFIGURED',
      'API Key STT belum dikonfigurasi. Harap isi ELICE_API_KEY atau OPENAI_API_KEY di file .env.'
    );
  }

  const baseURL = sanitizeBaseUrl(rawBaseURL);

  try {
    const OpenAI = require('openai');
    return new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });
  } catch {
    return null; // Package openai belum terinstal, akan fallback ke native fetch
  }
}

/**
 * Transkripsi audio menggunakan native Fetch (fallback jika library openai belum terinstal)
 */
async function transcribeWithFetch({ audioFilePath, customVocabulary, apiKey, baseURL, model }) {
  const targetBase = sanitizeBaseUrl(baseURL);
  const endpoint = `${targetBase}/audio/transcriptions`;

  const audioBuffer = await fs.promises.readFile(audioFilePath);
  const ext = path.extname(audioFilePath).toLowerCase();
  const mimeType = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
  const audioBlob = new Blob([audioBuffer], { type: mimeType });

  const formData = new FormData();
  formData.append('file', audioBlob, path.basename(audioFilePath));
  formData.append('model', model);
  formData.append('language', 'indonesian');
  formData.append('return_timestamps', 'word');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  if (customVocabulary && typeof customVocabulary === 'string' && customVocabulary.trim()) {
    formData.append('prompt', customVocabulary.trim());
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new AppError(
      response.status >= 500 ? 502 : 400,
      'STT_API_ERROR',
      `Gagal memanggil STT API (${response.status}): ${errorText || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Layanan Speech-to-Text (STT) untuk mentranskripsi file audio menjadi teks dengan Word-Level Timestamps
 * @param {string} audioFilePath - Path lokal file audio (WAV/MP3) yang akan ditranskripsikan
 * @param {string} [customVocabulary=''] - Kosakata istilah khusus (maks 20 kata) sebagai hint/prompt
 * @returns {Promise<Object>} JSON hasil transkripsi lengkap dengan kata dan timestamp (start_time, end_time)
 */
async function transcribeAudio(audioFilePath, customVocabulary = '') {
  if (!audioFilePath || !fs.existsSync(audioFilePath)) {
    throw new AppError(400, 'AUDIO_FILE_NOT_FOUND', 'File audio untuk transkripsi tidak ditemukan di server.');
  }

  const apiKey = env.eliceApiKey || process.env.ELICE_API_KEY || process.env.OPENAI_API_KEY;
  const rawBaseURL = env.eliceApiBaseUrl || process.env.ELICE_API_BASE_URL || process.env.OPENAI_BASE_URL;
  const model = env.sttModel || process.env.STT_MODEL || 'whisper-large-v3';

  let rawResponse;

  const client = getOpenAIClient();
  if (client) {
    try {
      const fileStream = fs.createReadStream(audioFilePath);
      rawResponse = await client.audio.transcriptions.create({
        file: fileStream,
        model,
        language: 'indonesian',
        return_timestamps: 'word',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
        prompt: customVocabulary ? String(customVocabulary) : undefined,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(502, 'STT_SERVICE_FAILED', `Gagal mentranskripsi audio: ${err.message}`);
    }
  } else {
    // Fallback menggunakan Fetch bawaan Node.js
    rawResponse = await transcribeWithFetch({
      audioFilePath,
      customVocabulary,
      apiKey,
      baseURL: rawBaseURL,
      model,
    });
  }

  // Jika response berupa array (format khas Hugging Face pipeline)
  if (Array.isArray(rawResponse) && rawResponse.length > 0) {
    rawResponse = rawResponse[0];
  }

  // Normalisasi data kata dari berbagai format respon STT (OpenAI words vs Hugging Face chunks)
  let wordList = [];
  if (Array.isArray(rawResponse?.words)) {
    wordList = rawResponse.words;
  } else if (Array.isArray(rawResponse?.chunks)) {
    wordList = rawResponse.chunks.map((chunk) => {
      const [start, end] = Array.isArray(chunk.timestamp) ? chunk.timestamp : [0, 0];
      return {
        word: (chunk.text || '').trim(),
        text: (chunk.text || '').trim(),
        start,
        end,
      };
    });
  } else if (Array.isArray(rawResponse?.segments)) {
    for (const segment of rawResponse.segments) {
      if (Array.isArray(segment.words)) {
        wordList.push(...segment.words);
      }
    }
  }

  const normalizedWords = wordList.map((item) => {
    const textVal = item.word || item.text || '';
    const startVal = item.start ?? item.start_time ?? (Array.isArray(item.timestamp) ? item.timestamp[0] : 0);
    const endVal = item.end ?? item.end_time ?? (Array.isArray(item.timestamp) ? item.timestamp[1] : 0);

    return {
      word: textVal,
      text: textVal,
      start_time: Number(startVal ?? 0),
      end_time: Number(endVal ?? 0),
      confidence: item.confidence ?? 1.0,
    };
  });

  return {
    text: rawResponse.text || '',
    language: rawResponse.language || 'id',
    duration: rawResponse.duration ?? null,
    words: normalizedWords,
    segments: rawResponse.segments || [],
    audioPath: audioFilePath.replaceAll('\\', '/'),
  };
}

module.exports = {
  transcribeAudio,
};
