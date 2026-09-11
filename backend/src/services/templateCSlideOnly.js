/**
 * Template C: Slide Only
 *
 * Reframes slide-only content (no camera feed) into 9:16 without dead space.
 * Uses blurred-background fill: the slide is centered on a stretched, blurred
 * copy of itself filling the full canvas.
 *
 * Fill strategy is a fixed implementation decision (blurred background), not a
 * runtime option. Blur radius is hard-coded to a reasonable default.
 *
 * @param {import('fluent-ffmpeg').FfmpegCommand} command - fluent-ffmpeg command instance (trim already applied)
 * @param {object} options - this template ignores all options
 */
function buildFilterChain(command, options) {
  // Background: scale to fill 1080×1920 canvas, crop excess, apply heavy blur
  // Main: scale to fit 1080×1344 (top 70% of canvas), preserve aspect ratio
  // Overlay: center main vertically on top of blurred background
  const filterGraph = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg]`,
    `[0:v]scale=1080:1344:force_original_aspect_ratio=decrease,pad=1080:1344:(ow-iw)/2:(oh-ih)/2:color=black[main]`,
    `[bg][main]overlay=(W-w)/2:(H-h)/2`,
  ].join(';');

  command.complexFilter(filterGraph);
}

module.exports = { buildFilterChain };
