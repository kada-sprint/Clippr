const cookieSession = require('cookie-session');
const AppError = require('../utils/app-error');

const SESSION_DURATION_MS = 60 * 60 * 1000;

function createSessionMiddleware({ secret, secure }) {
  if (secret.length < 32) {
    return (req, res, next) => next(new AppError(503, 'SESSION_NOT_CONFIGURED', 'Konfigurasi sesi login belum tersedia.'));
  }
  return cookieSession({
    name: 'clippr_session',
    keys: [secret],
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_DURATION_MS,
  });
}

function requireAuth(req, res, next) {
  // Enforce expiry on the server too; a client can replay an expired cookie.
  if (typeof req.session?.userId !== 'string' || !req.session.userId ||
      !Number.isFinite(req.session.expiresAt) || req.session.expiresAt <= Date.now()) {
    req.session = null;
    return next(new AppError(401, 'UNAUTHENTICATED', 'Silakan masuk kembali untuk melanjutkan.'));
  }
  req.userId = req.session.userId;
  next();
}

function requireTrustedOrigin(frontendOrigin) {
  return (req, res, next) => {
    if (req.get('origin') !== frontendOrigin) {
      return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Asal permintaan tidak diizinkan.'));
    }
    if (!req.is('application/json')) {
      return next(new AppError(415, 'JSON_REQUIRED', 'Gunakan Content-Type application/json.'));
    }
    next();
  };
}

module.exports = { createSessionMiddleware, requireAuth, requireTrustedOrigin, SESSION_DURATION_MS };
