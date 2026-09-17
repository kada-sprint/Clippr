const AppError = require('../utils/app-error');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    error = new AppError(400, 'INVALID_JSON', 'Body harus berupa JSON yang valid.');
  } else if (error.type === 'entity.too.large') {
    error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Body request terlalu besar.');
  }
  const known = error instanceof AppError;
  res.status(known ? error.status : 500).json({
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'Terjadi kesalahan internal.',
    },
  });
}

module.exports = errorHandler;
