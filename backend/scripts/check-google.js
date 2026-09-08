// Local diagnostic only: verifies real Google tokens without writing to Aiven.
const fs = require('node:fs');
const path = require('node:path');
const env = require('../src/config/env');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth.service');
const express = require('express');

if (!env.googleClientId.endsWith('.apps.googleusercontent.com')) {
  console.error('Isi GOOGLE_CLIENT_ID di .env terlebih dahulu.');
  process.exit(1);
}

let verifiedCount = 0;
const authenticate = createAuthService({
  saveUser: async (profile) => {
    verifiedCount += 1;
    return profile;
  },
});
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // Restrict this diagnostic to the exact local origin, including DNS rebinding protection.
  if (req.get('host') !== 'localhost:5173' ||
      (req.method === 'POST' && req.get('origin') !== 'http://localhost:5173')) {
    return res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Gunakan http://localhost:5173.' } });
  }
  next();
});
app.get('/', (req, res) => res.type('html').send(fs.readFileSync(path.join(__dirname, 'google-check.html'), 'utf8')));
app.get('/config', (req, res) => res.json({ clientId: env.googleClientId }));
app.get('/check-status', (req, res) => res.json({ verifiedCount, persistence: false }));
app.use(createApp({ authenticateGoogle: authenticate }));

const server = app.listen(5173, '127.0.0.1', () => {
  console.log('Diagnostik Google: http://localhost:5173 (tanpa perubahan database).');
});
server.on('error', () => {
  console.error('Diagnostik tidak dapat memakai port 5173. Hentikan proses lain pada port tersebut terlebih dahulu.');
  process.exitCode = 1;
});
