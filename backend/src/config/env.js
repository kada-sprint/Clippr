const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

module.exports = {
  port: Number(process.env.PORT || 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  production: process.env.NODE_ENV === 'production',
  eliceApiKey: process.env.ELICE_API_KEY || process.env.OPENAI_API_KEY || '',
  eliceApiBaseUrl: process.env.ELICE_API_BASE_URL || process.env.OPENAI_BASE_URL || '',
  sttModel: process.env.STT_MODEL || 'whisper-large-v3',
};
