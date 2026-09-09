const { Router } = require('express');
const { createProjectController } = require('../controllers/project.controller');
const { createUploadMiddleware } = require('../middlewares/upload.middleware');
const { createSessionMiddleware } = require('../middlewares/session');

/**
 * Factory untuk rute proyek Cuplik (/api/projects)
 */
function createProjectRoutes({
  projectService,
  sessionSecret,
  production,
} = {}) {
  const router = Router();
  const controller = createProjectController({ projectService });
  const uploadMiddleware = createUploadMiddleware();

  // Pastikan respons API tidak di-cache oleh browser/proxy
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Pasang session middleware jika secret tersedia agar req.session dapat dibaca
  if (sessionSecret) {
    router.use(createSessionMiddleware({ secret: sessionSecret, secure: production }));
  }

  /**
   * POST /api/projects/upload
   * Menerima multipart/form-data:
   * - video_file (single file .mp4/.mov, maks 1GB)
   * - selected_layout (string: 'SLIDE_CAM' | 'TALKING_HEAD' | 'SLIDE_ONLY')
   * - custom_vocabulary (string dipisahkan koma, maks 20 kata)
   */
  router.post('/upload', uploadMiddleware, controller.upload);

  return router;
}

module.exports = { createProjectRoutes };
