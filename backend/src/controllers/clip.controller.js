const { createClipService } = require('../services/clip.service');

function createClipController({
  clipService = createClipService(),
} = {}) {
  return {
    async list(req, res, next) {
      try {
        const clips = await clipService.listClips(req.userId, req.params.id);
        res.json({ clips });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createClipController };
