const ffmpeg = require('fluent-ffmpeg');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
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

// Konfigurasi binary FFprobe:
// 1. Utamakan variabel environment FFPROBE_PATH jika ditentukan
// 2. Gunakan package @ffprobe-installer/ffprobe jika tersedia
// 3. Fallback ke ffprobe-static jika tersedia
let ffprobeBinaryPath = process.env.FFPROBE_PATH || null;

if (!ffprobeBinaryPath) {
  try {
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    if (ffprobeInstaller?.path) {
      ffprobeBinaryPath = ffprobeInstaller.path;
    }
  } catch {
    // @ffprobe-installer tidak tersedia
  }
}

if (!ffprobeBinaryPath) {
  try {
    const ffprobeStatic = require('ffprobe-static');
    if (ffprobeStatic?.path) {
      ffprobeBinaryPath = ffprobeStatic.path;
    } else if (typeof ffprobeStatic === 'string') {
      ffprobeBinaryPath = ffprobeStatic;
    }
  } catch {
    // ffprobe-static tidak tersedia
  }
}

if (ffprobeBinaryPath) {
  ffmpeg.setFfprobePath(ffprobeBinaryPath);
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
      let command = ffmpeg(inputVideoPath, { timeout: 600 })
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

/**
 * Mendapatkan durasi audio dalam detik menggunakan ffprobe
 * @param {string} audioPath - Path file audio
 * @returns {Promise<number>} Durasi dalam detik
 */
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    if (!audioPath || !fs.existsSync(audioPath)) {
      return reject(new AppError(404, 'FILE_NOT_FOUND', `File audio tidak ditemukan: ${audioPath}`));
    }

    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        return reject(new AppError(500, 'FFPROBE_FAILED', `Gagal membaca durasi audio: ${err.message}`));
      }
      const duration = metadata?.format?.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new AppError(500, 'DURATION_UNKNOWN', 'Tidak dapat menentukan durasi audio.'));
      }
      resolve(duration);
    });
  });
}

/**
 * Memotong audio menjadi chunk pada offset tertentu
 * @param {string} audioPath - Path file audio sumber
 * @param {number} startSec - Detik mulai
 * @param {number} durationSec - Durasi chunk dalam detik
 * @returns {Promise<string>} Path file audio hasil potongan
 */
function splitAudioChunk(audioPath, startSec, durationSec) {
  return new Promise((resolve, reject) => {
    if (!audioPath || !fs.existsSync(audioPath)) {
      return reject(new AppError(404, 'FILE_NOT_FOUND', `File audio tidak ditemukan: ${audioPath}`));
    }

    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const outputFilename = `chunk-${uniqueSuffix}.mp3`;
    // Simpan file chunk temporer di folder temporer OS (os.tmpdir())
    // agar penambahan file sementara tidak memicu restart pada Node.js --watch
    const outputPath = path.join(os.tmpdir(), outputFilename);

    function runSplit(withPreset = true) {
      let command = ffmpeg(audioPath)
        .setStartTime(startSec)
        .setDuration(durationSec)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .format('mp3');

      if (withPreset) {
        command = command.outputOptions(['-preset ultrafast']);
      }

      command
        .output(outputPath)
        .on('end', () => resolve(outputPath.replaceAll('\\', '/')))
        .on('error', (err) => {
          if (withPreset && err.message && err.message.toLowerCase().includes('preset')) {
            return runSplit(false);
          }
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          reject(new AppError(500, 'CHUNK_SPLIT_FAILED', `Gagal memotong audio: ${err.message}`));
        })
        .run();
    }

    runSplit(true);
  });
}

module.exports = {
  validateVideo,
  extractAudio,
  getAudioDuration,
  splitAudioChunk,
  AUDIO_DIR,
};

function validateVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, ['-v', 'error'], (error, metadata) => {
      if (error) return reject(new AppError(400, 'INVALID_MEDIA', 'Berkas video tidak dapat dibaca.'));
      const duration = Number(metadata.format?.duration);
      const video = metadata.streams?.find((stream) => stream.codec_type === 'video');
      const audio = metadata.streams?.find((stream) => stream.codec_type === 'audio');
      const formats = (metadata.format?.format_name || '').split(',');
      if (!video || !audio || !formats.some((format) => ['mov', 'mp4'].includes(format)) ||
          !Number.isFinite(duration) || duration <= 0 || duration > 2700 ||
          Number(metadata.format?.size) > 1024 * 1024 * 1024) {
        return reject(new AppError(400, 'INVALID_MEDIA', 'Gunakan MP4/MOV dengan video dan audio, maksimal 45 menit dan 1 GB.'));
      }
      resolve(metadata);
    });
  });
}
