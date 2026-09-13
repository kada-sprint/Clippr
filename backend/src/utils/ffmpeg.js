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
 * Mengekstrak track audio dari video dan mengonversinya ke format MP3 mono 16kHz
 * Ukuran file jauh lebih ringkas (~10x dibanding WAV PCM) untuk transmisi cepat ke STT API
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

    // Gunakan ekstensi .mp3 untuk kompresi maksimal dan transmisi cepat ke Cloudflare/Elice
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const outputFilename = `audio-${uniqueSuffix}.mp3`;
    const outputPath = path.join(AUDIO_DIR, outputFilename);

    function runExtraction(withPreset = true) {
      let command = ffmpeg(inputVideoPath)
        .noVideo()                     // Hanya ambil track audio
        .audioChannels(1)              // Mono (1 channel)
        .audioFrequency(16000)         // Sample rate 16kHz standar Whisper
        .audioCodec('libmp3lame')       // Codec kompresi MP3
        .audioBitrate('64k')           // Bitrate vokal hemat bandwidth
        .format('mp3');

      if (withPreset) {
        command = command.outputOptions(['-preset ultrafast']);
      }

      command
        .output(outputPath)
        .on('end', () => {
          resolve(outputPath.replaceAll('\\', '/'));
        })
        .on('error', (err) => {
          // Fallback tanpa preset jika build FFmpeg menolak flag preset pada audio codec
          if (withPreset && err.message && err.message.toLowerCase().includes('preset')) {
            return runExtraction(false);
          }

          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
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
    }

    runExtraction(true);
  });
}

module.exports = {
  extractAudio,
  AUDIO_DIR,
};
