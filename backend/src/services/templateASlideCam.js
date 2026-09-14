const { CAMERA_BOX_POSITION } = require('./reframeCommon');

/**
 * Template A: Slide + Camera Overlay
 *
 * Reframes slide-plus-webcam-overlay source into 9:16.
 * Slide occupies the top ~70%, camera overlay sits in the bottom ~30%.
 *
 * KNOWN LIMITATION: The slide region is cropped from the horizontal band above
 * CAMERA_BOX_POSITION.y. Slide content beside the camera in that band is also
 * excluded. No face/screen detection is in scope — this is a fixed positional
 * assumption. See docs/adr/0006-camera-band-tradeoff.md.
 *
 * @param {import('fluent-ffmpeg').FfmpegCommand} command - fluent-ffmpeg command instance (trim already applied)
 * @param {object} options - template options (this template ignores unknown fields)
 */
function buildFilterChain(command, options) {
  const cam = CAMERA_BOX_POSITION;

  // Slide region: crop the full source frame (the camera sits ON TOP of the slide
  // in the source, not in a separate band). Scale to fill 1080px width,
  // position at top of 1920px canvas.
  const slideFilter = [
    `[0:v]crop=iw:ih:0:0`,
    `scale=1080:-2`,
    `pad=1080:1920:0:0:color=black[slide]`,
  ].join(',');

  // Camera overlay: crop the camera rectangle from the original source,
  // scale to fit the bottom 30% area (1080×576), centered horizontally
  const camFilter = [
    `[0:v]crop=iw*${cam.w}:ih*${cam.h}:iw*${cam.x}:ih*${cam.y}`,
    `scale=1080:576:force_original_aspect_ratio=decrease`,
    `pad=1080:576:(ow-iw)/2:(oh-ih)/2:color=black[cam]`,
  ].join(',');

  const filterGraph = [
    slideFilter,
    camFilter,
    `[slide][cam]overlay=0:1344`,
  ].join(';');

  command.complexFilter(filterGraph);
}

module.exports = { buildFilterChain };
