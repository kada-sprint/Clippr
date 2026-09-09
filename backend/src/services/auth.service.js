const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');
const { upsertGoogleUser, findUserById } = require('../models/user.model');
const AppError = require('../utils/app-error');

const googleClient = new OAuth2Client();

function createAuthService({
  clientId = env.googleClientId,
  verifyIdToken = (options) => googleClient.verifyIdToken(options),
  saveUser = upsertGoogleUser,
} = {}) {
  return async function authenticateGoogle(credential) {
    if (typeof credential !== 'string' || !credential.trim() || credential.length > 16384) {
      throw new AppError(400, 'INVALID_CREDENTIAL', 'credential harus berupa ID token Google.');
    }
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'Google client ID belum dikonfigurasi.');
    }

    let payload;
    try {
      // The official library verifies signature, issuer, expiry, and audience.
      const ticket = await verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch (error) {
      if (error.response || error.message?.startsWith('Failed to retrieve verification certificates:') ||
          ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error.code)) {
        throw new AppError(503, 'GOOGLE_UNAVAILABLE', 'Verifikasi Google sedang tidak tersedia.');
      }
      throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'ID token Google tidak valid atau kedaluwarsa.');
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Identitas Google tidak memenuhi persyaratan login.');
    }

    try {
      return await saveUser({
        id: payload.sub,
        email: payload.email,
        displayName: payload.name || payload.email,
        avatarUrl: payload.picture || null,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Penyimpanan pengguna belum tersedia.');
    }
  };
}

function createCurrentUserService({ findUser = findUserById } = {}) {
  return async function getCurrentUser(id) {
    let user;
    try {
      user = await findUser(id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Data pengguna belum tersedia.');
    }
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Akun tidak ditemukan. Silakan masuk kembali.');
    return user;
  };
}

module.exports = { createAuthService, createCurrentUserService };
