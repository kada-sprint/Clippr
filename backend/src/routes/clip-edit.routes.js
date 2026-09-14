const { Router } = require('express');
const { createClipController } = require('../controllers/clip.controller');
const {
  createSessionMiddleware,
  requireAuth,
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

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.patch('/clips/:clipId', session, requireAuth, controller.update);
  router.get('/clips/:clipId/transcript', session, requireAuth, controller.getTranscript);
  router.post('/clips/:clipId/render', session, requireAuth, controller.render);

  return router;
}

module.exports = { createClipEditRoutes };
