const { createProjectService } = require('../services/project.service');

/**
 * Controller untuk menangani HTTP request dan response terkait fitur proyek
 */
function createProjectController({
  projectService = createProjectService(),
} = {}) {
  return {
    async upload(req, res, next) {
      try {
        // Ambil ID pengguna dari session cookie (jika login), atau dari body (fleksibel untuk pengujian)
        const userId = req.session?.userId || req.userId || req.body?.user_id;

        const project = await projectService.handleVideoUpload({
          file: req.file,
          selectedLayout: req.body?.selected_layout,
          customVocabulary: req.body?.custom_vocabulary,
          userId,
        });

        res.status(201).json({
          message: 'Video berhasil diunggah dan audio berhasil diekstrak.',
          project,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createProjectController };
