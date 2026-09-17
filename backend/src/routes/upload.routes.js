const { Router } = require('express');
const { createUploadController } = require('../controllers/upload.controller');
const { createUploadMiddleware } = require('../middlewares/upload.middleware');
const { createSessionMiddleware, requireAuth, requireSameOrigin, requireTrustedOrigin } = require('../middlewares/session');

function createUploadRoutes({ uploadService, sessionSecret, frontendOrigin, production } = {}) {
  const router = Router();
  const controller = createUploadController({ uploadService });
  const session = createSessionMiddleware({ secret: sessionSecret, secure: production });
  const sameOrigin = requireSameOrigin(frontendOrigin);
  const trustedJson = requireTrustedOrigin(frontendOrigin);
  const upload = createUploadMiddleware();

  router.post('/upload/initiate', session, requireAuth, trustedJson, controller.initiate);
  router.post('/:id/source/complete', session, requireAuth, trustedJson, controller.complete);
  router.post('/upload', session, requireAuth, sameOrigin, upload, controller.directUpload);
  router.post('/:id/source', session, requireAuth, sameOrigin, upload, controller.upload);
  return router;
}

module.exports = { createUploadRoutes };
