const path = require('node:path');
const { createMediaService } = require('../services/media.service');

function createMediaController({
  mediaService = createMediaService(),
} = {}) {
  return {
    async serveClipMedia(req, res, next) {
      try {
        const { projectId, clipId, filename } = req.params;
        const filePath = await mediaService.resolveAndVerify(
          req.userId, projectId, clipId, filename,
        );

        const ext = path.extname(filename).toLowerCase();
        const contentType = ext === '.srt' ? 'application/x-subrip' : 'video/mp4';

        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'private, max-age=3600');
        res.sendFile(filePath);
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createMediaController };
