const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { createAuthService } = require('../src/services/auth.service');

test('official verifier rejects wrong audience, issuer, expiry, and tampered signature', async () => {
  // Local signing keys test the actual Google library without claiming a live Google login.
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const client = new OAuth2Client();
  client.getFederatedSignonCertsAsync = async () => ({
    certs: { fixture: publicKey.export({ type: 'spki', format: 'pem' }) },
  });
  const clientId = 'test.apps.googleusercontent.com';
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: 'verified-subject', email: 'trainer@example.com', email_verified: true,
    aud: clientId, iss: 'https://accounts.google.com', iat: now, exp: now + 3600,
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  function token(payload) {
    const body = `${encode({ alg: 'RS256', kid: 'fixture', typ: 'JWT' })}.${encode(payload)}`;
    return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
  }
  let writes = 0;
  const authenticate = createAuthService({
    clientId, verifyIdToken: (options) => client.verifyIdToken(options),
    saveUser: async (profile) => { writes += 1; return profile; },
  });
  assert.equal((await authenticate(token(claims))).id, claims.sub);
  const valid = token(claims).split('.');
  valid[1] = encode({ ...claims, sub: 'attacker' });
  for (const invalid of [
    token({ ...claims, aud: 'other.apps.googleusercontent.com' }),
    token({ ...claims, iss: 'https://attacker.example.com' }),
    token({ ...claims, iat: now - 7200, exp: now - 3600 }),
    valid.join('.'),
  ]) {
    await assert.rejects(authenticate(invalid), { status: 401, code: 'INVALID_GOOGLE_TOKEN' });
  }
  assert.equal(writes, 1);
});
