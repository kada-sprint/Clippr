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

    async update(req, res, next) {
      try {
        const clip = await clipService.updateClip(req.userId, req.params.clipId, req.body);
        res.json({ clip });
      } catch (error) {
        next(error);
      }
    },

    async getTranscript(req, res, next) {
      try {
        const transcript = await clipService.getTranscript(req.userId, req.params.clipId);
        res.json(transcript);
      } catch (error) {
        next(error);
      }
    },

    async render(req, res, next) {
      try {
        const clip = await clipService.renderClip(req.userId, req.params.clipId);
        res.json({ clip });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createClipController };
