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

// Konfigurasi binary FFmpeg:
// 1. Utamakan variabel environment FFMPEG_PATH jika ditentukan
// 2. Gunakan package ffmpeg-static yang menyediakan binary standalone otomatis
// 3. Fallback ke @ffmpeg-installer/ffmpeg jika tersedia
let ffmpegBinaryPath = process.env.FFMPEG_PATH || null;

if (!ffmpegBinaryPath) {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
      ffmpegBinaryPath = ffmpegStatic;
    }
  } catch {
    // ffmpeg-static belum terpasang atau belum di-resolve
  }
}

if (!ffmpegBinaryPath) {
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller?.path) {
      ffmpegBinaryPath = ffmpegInstaller.path;
    }
  } catch {
    // @ffmpeg-installer tidak tersedia
  }
}

if (ffmpegBinaryPath) {
  ffmpeg.setFfmpegPath(ffmpegBinaryPath);
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

    if (!fs.existsSync(inputVideoPath)) {
      return reject(new AppError(404, 'FILE_NOT_FOUND', `File video input tidak ditemukan di path: ${inputVideoPath}`));
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
        // Hapus file audio parsial jika sempat dibuat tapi gagal
        if (fs.existsSync(outputPath)) {
          try {
            fs.unlinkSync(outputPath);
          } catch {
            // Abaikan jika gagal menghapus file parsial
          }
        }

        const isMissingBinary = err.message && (
          err.message.includes('Cannot find ffmpeg') ||
          err.message.includes('spawn ffmpeg ENOENT')
        );

        const detailMessage = isMissingBinary
          ? 'Binary FFmpeg tidak ditemukan pada server. Pastikan modul ffmpeg-static terpasang ("npm install ffmpeg-static" di folder backend) atau tentukan FFMPEG_PATH di .env.'
          : `Gagal mengekstrak audio: ${err.message}`;

        reject(new AppError(500, 'AUDIO_EXTRACTION_FAILED', detailMessage));
      })
      .run();
  });
}

module.exports = {
  extractAudio,
  AUDIO_DIR,
};
