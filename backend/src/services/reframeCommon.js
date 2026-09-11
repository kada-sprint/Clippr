const ffmpeg = require('fluent-ffmpeg');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = 60_000;

// Template A camera-box assumption — documented assumption, not a guarantee.
// No face/screen detection is in scope per FRD risk table.
// Normalized 0–1, origin top-left, fraction of source frame.
const CAMERA_BOX_POSITION = { x: 0.80, y: 0.02, w: 0.18, h: 0.15 };

// Detect ffmpeg binary: prefer env var, then package installer, then system PATH
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
} else {
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller?.path) {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    }
  } catch {
    // Use system ffmpeg from PATH
  }
}

/**
 * Apply trim as output-side options (frame-accurate).
 * Must be called before adding template-specific filters.
 */
function applyTrim(command, startTime, endTime) {
  return command.setStartTime(startTime).duration(endTime - startTime);
}

/**
 * Dispatch to the correct template's buildFilterChain function.
 * Templates are internal implementation details — workers call renderClip(), not templates directly.
 */
const TEMPLATE_BUILDERS = {
  'slide-cam': () => require('./templateASlideCam').buildFilterChain,
  'talking-head': () => require('./templateBTalkingHead').buildFilterChain,
  'slide-only': () => require('./templateCSlideOnly').buildFilterChain,
};

/**
 * Render a video clip to 9:16 vertical format using the specified template.
 *
 * @param {string} inputPath - Local filesystem path to the source video
 * @param {number} startTime - Start time in seconds (inclusive)
 * @param {number} endTime - End time in seconds (exclusive), must be > startTime
 * @param {string} outputPath - Full path including filename for the output file
 * @param {string} template - Required: 'slide-cam' | 'talking-head' | 'slide-only'
 * @param {object} [options={}]
 * @param {number} [options.timeoutMs] - Override the default 60s timeout
 * @param {number} [options.horizontalOffset] - Template B only: normalized 0–1, positive = right, default 0
 * @returns {Promise<{success: boolean, outputPath: string | null, duration: number, error: string | null}>}
 */
async function renderClip(inputPath, startTime, endTime, outputPath, template, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!template || !TEMPLATE_BUILDERS[template]) {
    return {
      success: false,
      outputPath: null,
      duration: 0,
      error: `Unknown template: ${template}`,
    };
  }

  // Validate input file exists
  try {
    await fs.promises.access(inputPath, fs.constants.R_OK);
  } catch {
    return {
      success: false,
      outputPath: null,
      duration: 0,
      error: `Input file not found: ${inputPath}`,
    };
  }

  // Validate time range
  if (typeof startTime !== 'number' || typeof endTime !== 'number') {
    return {
      success: false,
      outputPath: null,
      duration: 0,
      error: `Invalid time range: startTime=${startTime}, endTime=${endTime}`,
    };
  }

  if (startTime < 0 || endTime < 0 || startTime >= endTime) {
    return {
      success: false,
      outputPath: null,
      duration: 0,
      error: `Invalid time range: startTime=${startTime}, endTime=${endTime}`,
    };
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.promises.mkdir(outputDir, { recursive: true });

  const buildFilterChain = TEMPLATE_BUILDERS[template]();

  return new Promise((resolve) => {
    let stderrChunks = [];
    let timer;

    const proc = ffmpeg(inputPath);

    applyTrim(proc, startTime, endTime);

    proc.audioCodec('copy');

    buildFilterChain(proc, options);

    proc.videoCodec('libx264')
      .output(outputPath)
      .on('end', () => {
        clearTimeout(timer);
        resolve({
          success: true,
          outputPath,
          duration: endTime - startTime,
          error: null,
        });
      })
      .on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          outputPath: null,
          duration: 0,
          error: stderrChunks.join('') || err.message,
        });
      })
      .on('stderr', (line) => {
        stderrChunks.push(line + '\n');
      });

    // Hard timeout via manual timer (fluent-ffmpeg has no built-in timeout)
    timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({
        success: false,
        outputPath: null,
        duration: 0,
        error: 'timeout',
      });
    }, timeoutMs);

    proc.run();
  });
}

module.exports = {
  renderClip,
  applyTrim,
  DEFAULT_TIMEOUT_MS,
  CAMERA_BOX_POSITION,
};
