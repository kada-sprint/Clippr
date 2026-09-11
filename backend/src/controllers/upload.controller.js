const { createUploadService } = require('../services/upload.service');

function createUploadController({ uploadService = createUploadService() } = {}) {
  return {
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
          message: 'Sumber diterima dan diteruskan ke tahap analisis.',
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
        res.status(201).json({
          message: 'Video berhasil diunggah dan ditranskripsi.',
          project,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createUploadController };
