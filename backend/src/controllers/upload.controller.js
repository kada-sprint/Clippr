const { createUploadService } = require('../services/upload.service');

function createUploadController({ uploadService = createUploadService() } = {}) {
  return {
    async initiate(req, res, next) {
      try {
        const result = await uploadService.initiate({ userId: req.userId, body: req.body });
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
    async complete(req, res, next) {
      try {
        const project = await uploadService.complete({
          projectId: req.params.id,
          userId: req.userId,
          body: req.body,
        });
        res.status(202).json({
          message: 'Sumber diterima dan masuk antrean pemrosesan.',
          project,
        });
      } catch (error) {
        next(error);
      }
    },
    async upload(req, res, next) {
      try {
        const project = await uploadService.uploadSource({
          projectId: req.params.id,
          userId: req.userId,
          file: req.file,
          selectedLayout: req.body?.selected_layout,
          customVocabulary: req.body?.custom_vocabulary,
        });
        res.status(202).json({
          message: 'Sumber diterima dan masuk antrean pemrosesan.',
          project,
        });
      } catch (error) {
        next(error);
      }
    },
    async directUpload(req, res, next) {
      try {
        const project = await uploadService.directUpload({
          userId: req.userId,
          file: req.file,
          selectedLayout: req.body?.selected_layout,
          customVocabulary: req.body?.custom_vocabulary,
        });
        res.status(202).json({
          message: 'Sumber diterima dan masuk antrean pemrosesan.',
          project,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createUploadController };
