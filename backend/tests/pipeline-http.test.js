const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const { createApp } = require('../src/app');

test('HTTP upload/render admission returns 202 and validates session/origin before service access', async (t) => {
  const origin = 'http://localhost:5173';
  const id = '11111111-1111-4111-8111-111111111111';
  let admitted = 0;
  async function upload({ userId, file }) {
    assert.equal(userId, 'owner');
    await fs.unlink(file.path);
    admitted++;
    return { id, status: 'processing', processingStage: 'ingest' };
  }
  const app = createApp({
    sessionSecret: 'queue-test-session-secret-at-least-32-characters', frontendOrigin: origin, production: false,
    authenticateGoogle: async () => ({ id: 'owner' }), getCurrentUser: async () => ({ id: 'owner' }),
    uploadService: { directUpload: upload, uploadSource: upload },
    clipService: { renderClip: async (userId, clipId) => {
      assert.equal(userId, 'owner'); assert.equal(clipId, id); admitted++;
      return { id, status: 'rendering' };
    } },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(`${base}/auth/google`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{"credential":"test"}',
  });
  const cookie = login.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  for (const route of ['/projects/upload', `/projects/${id}/source`, `/clips/${id}/render`]) {
    assert.equal((await fetch(`${base}${route}`, { method: 'POST', headers: { Origin: origin } })).status, 401);
    assert.equal((await fetch(`${base}${route}`, { method: 'POST', headers: { Origin: 'http://other.invalid', Cookie: cookie } })).status, 403);
  }
  assert.equal(admitted, 0);
  for (const route of ['/projects/upload', `/projects/${id}/source`]) {
    const form = new FormData(); form.append('video_file', new Blob(['contract fixture'], { type: 'video/mp4' }), 'video.mp4');
    const response = await fetch(`${base}${route}`, { method: 'POST', headers: { Origin: origin, Cookie: cookie }, body: form });
    assert.equal(response.status, 202);
    assert.equal((await response.json()).project.processingStage, 'ingest');
  }
  const response = await fetch(`${base}/clips/${id}/render`, { method: 'POST', headers: { Origin: origin, Cookie: cookie } });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { clip: { id, status: 'rendering' } });
  assert.equal(admitted, 3);
});
