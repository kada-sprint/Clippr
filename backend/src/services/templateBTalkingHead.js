/**
 * Template B: Talking-Head
 *
 * Reframes presenter-only (no slide) source into a centered 9:16 crop.
 * Assumes the presenter is roughly horizontally centered.
 *
 * @param {import('fluent-ffmpeg').FfmpegCommand} command - fluent-ffmpeg command instance (trim already applied)
 * @param {object} options
 * @param {number} [options.horizontalOffset=0] - Normalized 0–1, positive = right of center, negative = left
 */
function buildFilterChain(command, options) {
  const horizontalOffset = options.horizontalOffset ?? 0;
  const subtitleSuffix = options.subtitleFilter ? `,${options.subtitleFilter}` : '';

  // Crop a vertical strip with 9:16 aspect ratio, centered on horizontalOffset.
  // Scale to fill 1080×1920 using lanczos for quality downscale.
  const filterGraph = `[0:v]crop=ih*0.5625:ih:(iw/2+iw*${horizontalOffset})-(ih*0.5625/2):0,scale=1080:1920:flags=lanczos${subtitleSuffix}`;

  command.complexFilter(filterGraph);
}

module.exports = { buildFilterChain };
