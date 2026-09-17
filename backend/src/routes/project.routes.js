const { Router } = require('express');
const { createProjectController } = require('../controllers/project.controller');
const {
  createSessionMiddleware,
  requireAuth,
  requireTrustedOrigin,
  requireSameOrigin,
} = require('../middlewares/session');

/**
 * Factory untuk rute proyek Cuplik (/api/projects)
 */
function createProjectRoutes({
  projectService,
  sessionSecret,
  frontendOrigin,
  production,
} = {}) {
  const router = Router();
  const controller = createProjectController({ projectService });
  const session = createSessionMiddleware({ secret: sessionSecret, secure: production });
  const trustedOrigin = requireTrustedOrigin(frontendOrigin);
  const sameOrigin = requireSameOrigin(frontendOrigin);

  // Pastikan respons API tidak di-cache oleh browser/proxy
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', session, requireAuth, controller.list);
  router.post('/', session, requireAuth, trustedOrigin, controller.create);
  router.get('/:id', session, requireAuth, controller.get);
  router.patch('/:id', session, requireAuth, trustedOrigin, controller.update);
  router.delete('/:id', session, requireAuth, sameOrigin, controller.remove);

  return router;
}

module.exports = { createProjectRoutes };
