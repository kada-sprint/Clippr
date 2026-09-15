const { Router } = require('express');
const { createClipController } = require('../controllers/clip.controller');
const {
  createSessionMiddleware,
  requireAuth,
  requireSameOrigin,
} = require('../middlewares/session');

function createClipEditRoutes({
  clipService,
  sessionSecret,
  frontendOrigin,
  production,
} = {}) {
  const router = Router();
  const controller = createClipController({ clipService });
  const session = createSessionMiddleware({ secret: sessionSecret, secure: production });
  const sameOrigin = requireSameOrigin(frontendOrigin);

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.patch('/clips/:clipId', session, requireAuth, sameOrigin, controller.update);
  router.get('/clips/:clipId/transcript', session, requireAuth, controller.getTranscript);
  router.post('/clips/:clipId/render', session, requireAuth, sameOrigin, controller.render);
  router.get('/clips/:clipId/export/mp4', session, requireAuth, controller.exportMp4);
  router.get('/clips/:clipId/export/srt', session, requireAuth, controller.exportSrt);

  return router;
}

module.exports = { createClipEditRoutes };
