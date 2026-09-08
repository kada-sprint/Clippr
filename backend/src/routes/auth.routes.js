const { Router } = require('express');
const { createAuthController } = require('../controllers/auth.controller');

function createAuthRoutes(authenticateGoogle) {
  const router = Router();
  router.post('/google', createAuthController(authenticateGoogle));
  return router;
}

module.exports = { createAuthRoutes };
