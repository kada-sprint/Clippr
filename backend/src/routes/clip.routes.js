const { Router } = require('express');
const { createClipController } = require('../controllers/clip.controller');
const {
  createSessionMiddleware,
  requireAuth,
} = require('../middlewares/session');

function createClipRoutes({
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

  router.get('/:id/clips', session, requireAuth, controller.list);

  return router;
}

module.exports = { createClipRoutes };
