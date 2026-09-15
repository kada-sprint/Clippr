const path = require('node:path');
// Initialize the shared fluent-ffmpeg binary configuration in the worker too.
require('../utils/ffmpeg');
const { renderClip } = require('./reframeCommon');
const { burnSubtitles } = require('./subtitleBurner');
const { generateSrt } = require('./srtGenerator');
const AppError = require('../utils/app-error');

async function renderMedia(project, clip, attemptToken) {
  const directory = path.resolve(__dirname, '../../uploads', project.id, clip.id);
  const vertical = path.join(directory, `vertical-${attemptToken}.mp4`);
  const subtitled = path.join(directory, `subtitled-${attemptToken}.mp4`);
  const srt = path.join(directory, `subtitles-${attemptToken}.srt`);
  const duration = Number(clip.endTime) - Number(clip.startTime);
  const layout = project.selectedLayout;
  if (!['slide-cam', 'talking-head', 'slide-only'].includes(layout) ||
      !['clean', 'active_word_highlight'].includes(clip.subtitleStyle) ||
      duration < 25 || duration > 75 || !clip.transcriptJson?.words?.length) {
    throw new AppError(422, 'INVALID_RENDER_INPUT', 'Layout, durasi, atau subtitle klip tidak valid.');
  }
  const timeoutMs = Math.max(120000, duration * 2000);
  const framed = await renderClip(project.sourceVideoPath, Number(clip.startTime), Number(clip.endTime), vertical, layout,
    { horizontalOffset: clip.horizontalOffset ?? 0, timeoutMs });
  if (!framed.success) throw new AppError(framed.error === 'timeout' ? 504 : 500, 'RENDER_FAILED', 'Render video gagal.');
  const burned = await burnSubtitles(vertical, clip.transcriptJson.words, clip.subtitleStyle, subtitled, { timeoutMs });
  if (!burned.success) throw new AppError(burned.error === 'timeout' ? 504 : 500, 'SUBTITLE_RENDER_FAILED', 'Render subtitle gagal.');
  const generated = generateSrt(clip.transcriptJson, srt);
  if (!generated.success) throw new AppError(500, 'SRT_GENERATION_FAILED', 'Ekspor subtitle gagal.');
  const now = new Date();
  return {
    status: 'rendered', clipVideoPath: vertical, subtitledVideoPath: subtitled, srtPath: srt,
    renderedAt: now, exportExpiresAt: new Date(now.getTime() + 86400000),
  };
}

module.exports = { renderMedia };
