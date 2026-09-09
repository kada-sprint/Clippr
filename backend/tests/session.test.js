const { test } = require('node:test');
const assert = require('node:assert/strict');
const Keygrip = require('keygrip');
const { createApp } = require('../src/app');
const { createCurrentUserService } = require('../src/services/auth.service');

const secret = 'a-test-only-session-secret-with-more-than-32-characters';
const origin = 'http://localhost:5173';
const alice = { id: 'alice-id', email: 'alice@example.com', displayName: 'Alice', avatarUrl: null };
const bob = { ...alice, id: 'bob-id', email: 'bob@example.com', displayName: 'Bob' };

async function serve(t, options = {}) {
  const server = createApp({
    sessionSecret: secret, frontendOrigin: origin, production: false,
    authenticateGoogle: async (token) => {
      if (token === 'alice-verified') return alice;
      if (token === 'bob-verified') return bob;
      assert.fail('unexpected test credential');
    },
    getCurrentUser: createCurrentUserService({ findUser: async (id) => [alice, bob].find((user) => user.id === id) || null }),
    ...options,
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}/api/auth`;
}

function post(url, path, body = {}, cookie = '', requestOrigin = origin) {
  return fetch(`${url}/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin, Cookie: cookie },
    body: JSON.stringify(body),
  });
}

function cookies(response) {
  return response.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
}

function signedCookie(session) {
  const value = Buffer.from(JSON.stringify(session)).toString('base64');
  const cookie = `clippr_session=${value}`;
  return `${cookie}; clippr_session.sig=${new Keygrip([secret]).sign(cookie)}`;
}

test('login issues HttpOnly session, survives a new app instance, and selects only its owner', async (t) => {
  const url = await serve(t);
  const response = await post(url, 'google', { credential: 'alice-verified', id: bob.id });
  assert.equal(response.status, 200);
  const cookie = cookies(response);
  const headers = response.headers.getSetCookie().join(';');
  assert.match(headers, /httponly/i);
  assert.match(headers, /samesite=lax/i);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  const payload = JSON.parse(Buffer.from(cookie.match(/clippr_session=([^;]+)/)[1], 'base64').toString());
  assert.deepEqual(Object.keys(payload).sort(), ['expiresAt', 'userId']);
  assert.equal(payload.userId, alice.id);
  assert.ok(payload.expiresAt > Date.now());
  const restartedUrl = await serve(t);
  const me = await fetch(`${restartedUrl}/me?id=${bob.id}`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).user, alice);
  assert.equal(me.headers.get('cache-control'), 'no-store');
  const bobLogin = await post(url, 'google', { credential: 'bob-verified' });
  const bobMe = await fetch(`${url}/me`, { headers: { Cookie: cookies(bobLogin) } });
  assert.deepEqual((await bobMe.json()).user, bob);
});

test('missing, forged and expired sessions never access the user store', async (t) => {
  const url = await serve(t, { getCurrentUser: () => assert.fail('must not read user') });
  for (const cookie of ['', 'clippr_session=forged; clippr_session.sig=fake',
    signedCookie({ userId: alice.id, expiresAt: Date.now() - 1 }), signedCookie({ userId: alice.id })]) {
    const response = await fetch(`${url}/me`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
  }
});

test('signed sessions cannot be changed to another user', async (t) => {
  const url = await serve(t);
  const valid = signedCookie({ userId: alice.id, expiresAt: Date.now() + 10000 });
  const forged = signedCookie({ userId: bob.id, expiresAt: Date.now() + 10000 }).split(';')[0];
  const response = await fetch(`${url}/me`, { headers: { Cookie: `${forged};${valid.split(';')[1]}` } });
  assert.equal(response.status, 401);
});

test('logout expires the browser cookies and is idempotent', async (t) => {
  const url = await serve(t);
  const login = await post(url, 'google', { credential: 'alice-verified' });
  const logout = await post(url, 'logout', {}, cookies(login));
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /clippr_session=;/);
  assert.match(logout.headers.get('set-cookie'), /expires=Thu, 01 Jan 1970/i);
  assert.equal((await fetch(`${url}/me`)).status, 401);
  assert.equal((await post(url, 'logout')).status, 204);
});

test('login and logout require the configured Origin and JSON', async (t) => {
  const url = await serve(t, { authenticateGoogle: () => assert.fail('must not authenticate') });
  for (const path of ['google', 'logout']) {
    for (const untrusted of ['https://attacker.example', 'null', '']) {
      const response = await post(url, path, {}, '', untrusted);
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED');
      assert.equal(response.headers.get('set-cookie'), null);
    }
    const response = await fetch(`${url}/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(response.status, 415);
  }
});

test('missing configuration fails closed; deleted users lose access and database errors are sanitized', async (t) => {
  const unconfigured = await serve(t, { sessionSecret: '' });
  assert.equal((await post(unconfigured, 'google', { credential: 'alice-verified' })).status, 503);
  const url = await serve(t, { getCurrentUser: createCurrentUserService({ findUser: async () => null }) });
  const login = await post(url, 'google', { credential: 'alice-verified' });
  const missing = await fetch(`${url}/me`, { headers: { Cookie: cookies(login) } });
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get('set-cookie'), /clippr_session=;/);
  const failed = createCurrentUserService({ findUser: async () => { throw new Error('private connection detail'); } });
  await assert.rejects(failed(alice.id), { status: 503, code: 'DATABASE_UNAVAILABLE', message: 'Data pengguna belum tersedia.' });
});
