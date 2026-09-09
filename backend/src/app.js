const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const AppError = require('./utils/app-error');
const { createAuthService, createCurrentUserService } = require('./services/auth.service');
const { createAuthRoutes } = require('./routes/auth.routes');
const { createProjectRoutes } = require('./routes/project.routes');
const errorHandler = require('./middlewares/error-handler');

function createApp({
  authenticateGoogle = createAuthService(),
  getCurrentUser = createCurrentUserService(),
  projectService,
  sessionSecret = env.sessionSecret,
  frontendOrigin = env.frontendOrigin,
  production = env.production,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: frontendOrigin, credentials: true, methods: ['GET', 'POST', 'OPTIONS'] }));
  app.use(express.json({ limit: '20kb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', createAuthRoutes({ authenticateGoogle, getCurrentUser, sessionSecret, frontendOrigin, production }));
  app.use('/api/projects', createProjectRoutes({ projectService, sessionSecret, production }));
  app.use((req, res, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', 'Endpoint tidak ditemukan.')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
