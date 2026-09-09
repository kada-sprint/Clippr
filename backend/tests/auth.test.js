const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth.service');

const clientId = 'test.apps.googleusercontent.com';
const identity = {
  sub: 'google-subject', email: 'trainer@example.com', email_verified: true,
  name: 'Trainer', picture: 'https://example.com/avatar.png',
};

async function serve(t, authenticateGoogle) {
  const server = createApp({ authenticateGoogle, sessionSecret: 'test-session-secret-that-is-at-least-32-characters', production: false }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(url, body) {
  return fetch(`${url}/api/auth/google`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify(body),
  });
}

test('health and unknown routes do not require a database', async (t) => {
  const url = await serve(t, async () => { throw new Error('must not authenticate'); });
  const response = await fetch(`${url}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  const missing = await fetch(`${url}/missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'ROUTE_NOT_FOUND');
});

test('credential is required before provider or database access', async (t) => {
  const url = await serve(t, createAuthService({
    clientId,
    verifyIdToken: async () => assert.fail('must not contact Google'),
    saveUser: async () => assert.fail('must not write'),
  }));
  for (const credential of [undefined, null, 42, '', ' ', 'x'.repeat(16385)]) {
    const response = await post(url, { credential });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_CREDENTIAL');
  }
});

test('only the verified Google identity is passed to persistence', async (t) => {
  const url = await serve(t, createAuthService({
    clientId,
    verifyIdToken: async (options) => {
      assert.deepEqual(options, { idToken: 'signed-token', audience: clientId });
      return { getPayload: () => identity };
    },
    saveUser: async (profile) => {
      assert.deepEqual(profile, {
        id: identity.sub, email: identity.email, displayName: identity.name, avatarUrl: identity.picture,
      });
      return profile;
    },
  }));
  const response = await post(url, { credential: 'signed-token', email: 'attacker@example.com', id: 'attacker' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.id, identity.sub);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('set-cookie'), /clippr_session=/);
  assert.match(response.headers.get('set-cookie'), /httponly/i);
});

test('invalid tokens cannot reach persistence', async (t) => {
  const url = await serve(t, createAuthService({
    clientId,
    verifyIdToken: async () => { throw new Error('sensitive-provider-detail'); },
    saveUser: async () => assert.fail('must not write'),
  }));
  const response = await post(url, { credential: 'bad-token' });
  assert.equal(response.status, 401);
  const text = await response.text();
  assert.match(text, /INVALID_GOOGLE_TOKEN/);
  assert.doesNotMatch(text, /sensitive-provider-detail|bad-token/);
});

test('missing subject or unverified email is rejected', async () => {
  for (const payload of [null, { ...identity, sub: '' }, { ...identity, email_verified: false }]) {
    const authenticate = createAuthService({
      clientId, verifyIdToken: async () => ({ getPayload: () => payload }),
      saveUser: async () => assert.fail('must not write'),
    });
    await assert.rejects(authenticate('token'), { status: 401, code: 'INVALID_GOOGLE_TOKEN' });
  }
});

test('provider outage, missing config, and database failures return sanitized 503', async () => {
  const unavailable = createAuthService({
    clientId, verifyIdToken: async () => { throw Object.assign(new Error('network'), { code: 'ENOTFOUND' }); },
  });
  await assert.rejects(unavailable('token'), { status: 503, code: 'GOOGLE_UNAVAILABLE' });
  await assert.rejects(createAuthService({ clientId: '' })('token'), { status: 503, code: 'GOOGLE_NOT_CONFIGURED' });
  const databaseFailure = createAuthService({
    clientId, verifyIdToken: async () => ({ getPayload: () => identity }),
    saveUser: async () => { throw new Error('postgresql://user:secret@host/db'); },
  });
  await assert.rejects(databaseFailure('token'), {
    status: 503, code: 'DATABASE_UNAVAILABLE', message: 'Penyimpanan pengguna belum tersedia.',
  });
});

test('malformed JSON and large bodies produce JSON errors', async (t) => {
  const url = await serve(t, async () => assert.fail('must not authenticate'));
  for (const [body, status, code] of [
    ['{broken', 400, 'INVALID_JSON'],
    [JSON.stringify({ credential: 'x'.repeat(22000) }), 413, 'PAYLOAD_TOO_LARGE'],
  ]) {
    const response = await fetch(`${url}/api/auth/google`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  }
});
