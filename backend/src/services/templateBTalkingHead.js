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

  // Crop a vertical strip with 9:16 aspect ratio, centered on horizontalOffset.
  // crop_height = full source height (ih)
  // crop_width  = ih * (9/16) = ih * 0.5625
  // crop_x      = center of source + offset, clamped to valid range
  //
  // Scale to fill 1080×1920 (force_original_aspect_ratio=decrease won't help here
  // since we already cropped to 9:16 — just scale to exact target).
  const filterGraph = `[0:v]crop=ih*0.5625:ih:(iw/2+iw*${horizontalOffset})-(ih*0.5625/2):0,scale=1080:1920:flags=lanczos`;

  command.videoFilters(filterGraph);
}

module.exports = { buildFilterChain };
