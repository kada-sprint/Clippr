const path = require('node:path');
const { createMediaService } = require('../services/media.service');

function createMediaController({
  mediaService = createMediaService(),
} = {}) {
  return {
    async serveClipMedia(req, res, next) {
      try {
        const { projectId, clipId, filename } = req.params;
        const media = await mediaService.resolveAndVerify(
          req.userId, projectId, clipId, filename,
        );

        if (media.url) return res.redirect(302, media.url);
        const ext = path.extname(filename).toLowerCase();
        res.set('Content-Type', media.contentType || (ext === '.srt' ? 'application/x-subrip' : 'video/mp4'));
        res.set('Cache-Control', 'private, max-age=3600');
        res.sendFile(media.filePath);
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createMediaController };
