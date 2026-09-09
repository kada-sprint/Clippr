const ffmpeg = require('fluent-ffmpeg');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const AppError = require('./app-error');

// Konfigurasi folder penyimpanan lokal audio: backend/uploads/audios/
const AUDIO_DIR = path.resolve(__dirname, '../../uploads/audios');

// Pastikan folder penyimpanan uploads/audios/ tersedia
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Deteksi binary ffmpeg: utamakan variabel environment FFMPEG_PATH atau package installer jika ada
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
} else {
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller?.path) {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    }
  } catch {
    // Jika package installer tidak ada, gunakan binary ffmpeg default dari sistem (PATH)
  }
}

/**
 * Mengekstrak track audio dari video dan mengonversinya ke format WAV 16kHz Mono
 * @param {string} inputVideoPath - Lokasi file video sumber
 * @returns {Promise<string>} Path file audio hasil ekstraksi
 */
function extractAudio(inputVideoPath) {
  return new Promise((resolve, reject) => {
    if (!inputVideoPath || typeof inputVideoPath !== 'string') {
      return reject(new AppError(400, 'INVALID_INPUT', 'Path video input tidak valid.'));
    }

    // Buat nama file audio unik
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const outputFilename = `audio-${uniqueSuffix}.wav`;
    const outputPath = path.join(AUDIO_DIR, outputFilename);

    ffmpeg(inputVideoPath)
      .noVideo()                     // Buang stream video, hanya ambil audionya
      .audioChannels(1)              // Konversi ke Mono (1 channel audio)
      .audioFrequency(16000)         // Sample rate 16kHz (16.000 Hz), standar untuk ASR / Whisper
      .audioCodec('pcm_s16le')       // Codec PCM 16-bit little-endian untuk format WAV murni
      .format('wav')                 // Format kontainer output .wav
      .output(outputPath)
      .on('end', () => {
        // Berhasil diekstrak, kembalikan path dengan format slash yang seragam
        resolve(outputPath.replaceAll('\\', '/'));
      })
      .on('error', (err) => {
        // Tangkap error jika ffmpeg gagal memproses
        reject(new AppError(500, 'AUDIO_EXTRACTION_FAILED', `Gagal mengekstrak audio: ${err.message}`));
      })
      .run();
  });
}

module.exports = {
  extractAudio,
  AUDIO_DIR,
};
