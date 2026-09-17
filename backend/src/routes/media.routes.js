const { Router } = require('express');
const { createMediaController } = require('../controllers/media.controller');
const {
  createSessionMiddleware,
  requireAuth,
} = require('../middlewares/session');

function createMediaRoutes({
  mediaService,
  sessionSecret,
} = {}) {
  const router = Router();
  const controller = createMediaController({ mediaService });
  const session = createSessionMiddleware({ secret: sessionSecret });

  router.get(
    '/:projectId/:clipId/:filename',
    session,
    requireAuth,
    controller.serveClipMedia,
  );

  return router;
}

module.exports = { createMediaRoutes };
