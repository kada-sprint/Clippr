const { Router } = require('express');
const { createAuthController } = require('../controllers/auth.controller');
const { createSessionMiddleware, requireAuth, requireTrustedOrigin } = require('../middlewares/session');

function createAuthRoutes({ authenticateGoogle, getCurrentUser, sessionSecret, frontendOrigin, production }) {
  const router = Router();
  const controller = createAuthController({ authenticateGoogle, getCurrentUser });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(createSessionMiddleware({ secret: sessionSecret, secure: production }));
  const trustedOrigin = requireTrustedOrigin(frontendOrigin);
  router.post('/google', trustedOrigin, controller.google);
  router.get('/me', requireAuth, controller.me);
  router.post('/logout', trustedOrigin, controller.logout);
  return router;
}

module.exports = { createAuthRoutes };
