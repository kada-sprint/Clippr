const { CAMERA_BOX_POSITION } = require('./reframeCommon');

/**
 * Template A: Slide + Subtitle Band + Camera
 *
 * Reframes slide-plus-webcam-overlay source into 9:16 with three bands:
 *   - Slide:     1080×1152 (top 60%)
 *   - Subtitle:  1080×192  (middle 10%, black background for subtitle)
 *   - Camera:    1080×576  (bottom 30%)
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

  // Slide: crop full source, scale to 1080w, pad to full 1080×1920 canvas
  const slideFilter = [
    `[0:v]crop=iw:ih:0:0`,
    `scale=1080:-2`,
    `pad=1080:1920:0:0:color=black`,
    `format=yuv420p[slide]`,
  ].join(',');

  // Camera: crop face rectangle, scale to 1080×576, centered
  const camFilter = [
    `[0:v]crop=iw*${cam.w}:ih*${cam.h}:iw*${cam.x}:ih*${cam.y}`,
    `scale=1080:576:force_original_aspect_ratio=decrease`,
    `pad=1080:576:(ow-iw)/2:(oh-ih)/2:color=black`,
    `format=yuv420p[cam]`,
  ].join(',');

  // Overlay camera at y=1344, then draw black subtitle band at y=1152
  const filterGraph = [
    slideFilter,
    camFilter,
    `[slide][cam]overlay=0:1344,drawbox=x=0:y=1152:w=1080:h=192:color=black:t=fill`,
  ].join(';');

  command.complexFilter(filterGraph);
}

module.exports = { buildFilterChain };
