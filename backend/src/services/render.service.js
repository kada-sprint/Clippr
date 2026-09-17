const path = require('node:path');
const fs = require('node:fs/promises');
// Initialize the shared fluent-ffmpeg binary configuration in the worker too.
require('../utils/ffmpeg');
const { renderClip } = require('./reframeCommon');
const { burnSubtitles, buildAss } = require('./subtitleBurner');
const { generateSrt } = require('./srtGenerator');
const AppError = require('../utils/app-error');
const env = require('../config/env');

function isAssUnavailable(error) {
  return error && (error.includes('ass') || error.includes('Invalid filter') || error.includes('No such filter'));
}

async function renderMedia(project, clip, attemptToken, options = {}) {
  const directory = options.outputDirectory || path.join(env.mediaRoot, 'uploads', project.id, clip.id);
  const subtitled = path.join(directory, `subtitled-${attemptToken}.mp4`);
  const srt = path.join(directory, `subtitles-${attemptToken}.srt`);
  const duration = Number(clip.endTime) - Number(clip.startTime);
  const layout = project.selectedLayout;
  if (!['slide-cam', 'talking-head', 'slide-only'].includes(layout) ||
      !['clean', 'active_word_highlight'].includes(clip.subtitleStyle) ||
      duration < 25 || duration > 75 || !clip.transcriptJson?.words?.length) {
    throw new AppError(422, 'INVALID_RENDER_INPUT', 'Layout, durasi, atau subtitle klip tidak valid.');
  }
  const timeoutMs = layout === 'slide-only'
    ? Math.max(180_000, duration * 3_000)
    : Math.max(120_000, duration * 2_000);
  const sourceVideoPath = options.sourceVideoPath || env.resolveMediaPath(project.sourceVideoPath);

  // Write ASS file upfront for single-pass attempt
  const assContent = buildAss(clip.transcriptJson.words, clip.subtitleStyle);
  const assPath = path.join(directory, `_subtitles_${attemptToken}.ass`);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(assPath, assContent, 'utf-8');

  let result;
  try {
    // Attempt single-pass: template filter + ASS subtitle in one FFmpeg command
    const filterPath = assPath.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "'\\''");
    const subtitleFilter = `ass=filename='${filterPath}'`;

    const framed = await renderClip(sourceVideoPath, Number(clip.startTime), Number(clip.endTime), subtitled, layout,
      { horizontalOffset: clip.horizontalOffset ?? 0, timeoutMs, subtitleFilter });

    if (framed.success) {
      result = {
        status: 'rendered',
        clipVideoPath: null,
        subtitledVideoPath: subtitled,
        srtPath: srt,
      };
    } else if (isAssUnavailable(framed.error)) {
      // ASS filter not available — fall back to two-pass
      console.warn('[Render] Single-pass ASS unavailable, falling back to two-pass.', { error: framed.error?.slice(0, 200) });
      result = await twoPassRender(sourceVideoPath, clip, attemptToken, directory, layout, timeoutMs);
    } else {
      throw new AppError(framed.error === 'timeout' ? 504 : 500, 'RENDER_FAILED', `Render video gagal: ${framed.error?.slice(0, 200) || 'unknown'}`);
    }
  } finally {
    // Clean up ASS temp file
    await fs.unlink(assPath).catch(() => {});
  }

  const generated = generateSrt(clip.transcriptJson, srt);
  if (!generated.success) throw new AppError(500, 'SRT_GENERATION_FAILED', 'Ekspor subtitle gagal.');

  const now = new Date();
  return { ...result, renderedAt: now, exportExpiresAt: new Date(now.getTime() + 86400000) };
}

async function twoPassRender(sourceVideoPath, clip, attemptToken, directory, layout, timeoutMs) {
  const vertical = path.join(directory, `vertical-${attemptToken}.mp4`);
  const subtitled = path.join(directory, `subtitled-${attemptToken}.mp4`);

  const framed = await renderClip(sourceVideoPath, Number(clip.startTime), Number(clip.endTime), vertical, layout,
    { horizontalOffset: clip.horizontalOffset ?? 0, timeoutMs });
  if (!framed.success) throw new AppError(framed.error === 'timeout' ? 504 : 500, 'RENDER_FAILED', `Render video gagal: ${framed.error?.slice(0, 200) || 'unknown'}`);

  const burned = await burnSubtitles(vertical, clip.transcriptJson.words, clip.subtitleStyle, subtitled, { timeoutMs });
  if (!burned.success) throw new AppError(burned.error === 'timeout' ? 504 : 500, 'SUBTITLE_RENDER_FAILED', `Render subtitle gagal: ${burned.error?.slice(0, 200) || 'unknown'}`);

  // Clean up intermediate vertical file
  await fs.unlink(vertical).catch(() => {});

  return {
    status: 'rendered',
    clipVideoPath: null,
    subtitledVideoPath: subtitled,
    srtPath: null,
  };
}

module.exports = { renderMedia };
