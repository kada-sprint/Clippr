const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Resolve the ffprobe binary path.
 * Follows the same detection chain as ffmpeg.js / reframeCommon.js:
 *   1. FFMPEG_PATH env var → derive ffprobe path from same directory
 *   2. @ffmpeg-installer/ffmpeg → derive ffprobe path from same directory
 *   3. System PATH fallback
 */
function resolveFfprobePath() {
  // 1. Derive from FFMPEG_PATH env var
  if (process.env.FFMPEG_PATH) {
    return path.join(path.dirname(process.env.FFMPEG_PATH), 'ffprobe');
  }

  // 2. Derive from @ffmpeg-installer/ffmpeg
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller?.path) {
      return path.join(path.dirname(ffmpegInstaller.path), 'ffprobe');
    }
  } catch {
    // Package not installed, fall through
  }

  // 3. System PATH — let execFile find it
  return 'ffprobe';
}

const FFPROBE_PATH = resolveFfprobePath();

/**
 * Get structured video metadata via ffprobe.
 *
 * @param {string} filePath - Absolute or relative path to the video file
 * @returns {Promise<{ width: number, height: number, codec: string, container: string, duration: number }>}
 */
function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath || typeof filePath !== 'string') {
      return reject(new Error('getVideoMetadata: filePath is required'));
    }

    if (!fs.existsSync(filePath)) {
      return reject(new Error(`getVideoMetadata: file not found: ${filePath}`));
    }

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ];

    execFile(FFPROBE_PATH, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        return reject(new Error(`ffprobe failed: ${err.message}`));
      }

      let probe;
      try {
        probe = JSON.parse(stdout);
      } catch (parseErr) {
        return reject(new Error(`ffprobe output parse failed: ${parseErr.message}`));
      }

      // Find the first video stream
      const videoStream = (probe.streams || []).find((s) => s.codec_type === 'video');
      if (!videoStream) {
        return reject(new Error('getVideoMetadata: no video stream found'));
      }

      const format = probe.format || {};
      const duration = parseFloat(format.duration);
      if (Number.isNaN(duration)) {
        return reject(new Error('getVideoMetadata: duration not available'));
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height,
        codec: videoStream.codec_name,
        container: format.format_name,
        duration,
      });
    });
  });
}

module.exports = { getVideoMetadata };
