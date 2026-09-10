const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createProjectService } = require('../src/services/project.service');

const origin = 'http://localhost:5173';
const sessionSecret = 'a-test-only-session-secret-with-more-than-32-characters';
const user = { id: 'owner-id', email: 'owner@example.com', displayName: 'Owner', avatarUrl: null };
const otherUser = { id: 'other-id', email: 'other@example.com', displayName: 'Other', avatarUrl: null };

function cookies(response) {
  return response.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
}

async function serve(t, projectService) {
  const app = createApp({
    projectService,
    sessionSecret,
    frontendOrigin: origin,
    production: false,
    authenticateGoogle: async (credential) => credential === 'other-verified' ? otherUser : user,
    getCurrentUser: async () => user,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}/api`;
}

async function login(baseUrl, credential = 'verified') {
  const response = await fetch(`${baseUrl}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ credential }),
  });
  assert.equal(response.status, 200);
  return cookies(response);
}

function createMemoryRepository(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    async listByUserId(userId) {
      return rows.filter((row) => row.userId === userId);
    },
    async createForUser(userId) {
      const row = {
        id: `00000000-0000-4000-8000-${String(rows.length + 1).padStart(12, '0')}`,
        userId,
        sourceVideoPath: null,
        selectedLayout: null,
        customVocabulary: '',
        status: 'idle',
        processingStage: null,
        transcriptJson: null,
        lastEditActivityAt: null,
        sourceExpiresAt: null,
        createdAt: new Date('2026-09-09T10:00:00.000Z'),
        _count: { clips: 0 },
      };
      rows.push(row);
      return row;
    },
    async findByIdForUser(id, userId) {
      return rows.find((row) => row.id === id && row.userId === userId) || null;
    },
    async updateSetupIfEmpty(id, userId, data) {
      const row = rows.find((item) => item.id === id && item.userId === userId);
      if (!row) return { state: 'missing' };
      if (row.status !== 'idle' || row.processingStage !== null ||
          row.sourceVideoPath !== null || row.transcriptJson !== null || row._count.clips > 0) {
        return { state: 'not_editable' };
      }
      Object.assign(row, data);
      return { state: 'updated', project: row };
    },
    async deleteIfEmpty(id, userId) {
      const index = rows.findIndex((item) => item.id === id && item.userId === userId);
      if (index < 0) return { state: 'missing' };
      const row = rows[index];
      if (row.status !== 'idle' || row.processingStage !== null ||
          row.sourceVideoPath !== null || row.transcriptJson !== null || row._count.clips > 0) {
        return { state: 'not_empty' };
      }
      rows.splice(index, 1);
      return { state: 'deleted' };
    },
  };
}

test('an authenticated user can create an empty project and retrieve it from the project list', async (t) => {
  const createdAt = new Date('2026-09-09T10:00:00.000Z').toISOString();
  const project = {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'idle',
    processingStage: null,
    selectedLayout: null,
    hasSource: false,
    clipCount: 0,
    createdAt,
  };
  const projects = [];
  const projectService = {
    async create(ownerId, body) {
      assert.equal(ownerId, user.id);
      assert.deepEqual(body, {});
      projects.push(project);
      return project;
    },
    async list(ownerId) {
      assert.equal(ownerId, user.id);
      return projects;
    },
  };
  const baseUrl = await serve(t, projectService);
  const cookie = await login(baseUrl);

  const createResponse = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: '{}',
  });
  assert.equal(createResponse.status, 201);
  assert.deepEqual(await createResponse.json(), { project });

  const listResponse = await fetch(`${baseUrl}/projects`, { headers: { Cookie: cookie } });
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), { projects: [project] });
});

test('project lists are isolated by session owner and never expose media paths', async (t) => {
  const repository = createMemoryRepository([{
    id: '22222222-2222-4222-8222-222222222222',
    userId: otherUser.id,
    sourceVideoPath: 'private/other/video.mp4',
    selectedLayout: 'SLIDE_CAM',
    customVocabulary: 'rahasia',
    status: 'processing',
    processingStage: 'ingest',
    transcriptJson: { secret: true },
    lastEditActivityAt: new Date('2026-09-09T09:00:00.000Z'),
    sourceExpiresAt: new Date('2026-09-10T09:00:00.000Z'),
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    _count: { clips: 0 },
  }]);
  const baseUrl = await serve(t, createProjectService({ projectRepository: repository }));
  const ownerCookie = await login(baseUrl);
  const otherCookie = await login(baseUrl, 'other-verified');

  const createResponse = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: ownerCookie },
    body: '{}',
  });
  assert.equal(createResponse.status, 201);

  const ownerResponse = await fetch(`${baseUrl}/projects`, { headers: { Cookie: ownerCookie } });
  assert.deepEqual((await ownerResponse.json()).projects, [{
    id: '00000000-0000-4000-8000-000000000002',
    status: 'idle',
    processingStage: null,
    selectedLayout: null,
    hasSource: false,
    clipCount: 0,
    createdAt: '2026-09-09T10:00:00.000Z',
  }]);

  const otherResponse = await fetch(`${baseUrl}/projects`, { headers: { Cookie: otherCookie } });
  const payload = await otherResponse.json();
  assert.equal(payload.projects.length, 1);
  assert.equal(payload.projects[0].hasSource, true);
  assert.equal(payload.projects[0].clipCount, 0);
  assert.doesNotMatch(JSON.stringify(payload), /private|transcript|rahasia|userId/i);
});

test('project detail requires a session and hides projects owned by another user', async (t) => {
  const projectId = '33333333-3333-4333-8333-333333333333';
  const repository = createMemoryRepository([{
    id: projectId,
    userId: user.id,
    sourceVideoPath: 'private/owner/video.mp4',
    selectedLayout: 'SLIDE_CAM',
    customVocabulary: 'Prisma, BullMQ',
    status: 'processing',
    processingStage: 'transcribe',
    transcriptJson: { private: true },
    lastEditActivityAt: new Date('2026-09-09T09:00:00.000Z'),
    sourceExpiresAt: new Date('2026-09-10T09:00:00.000Z'),
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    _count: { clips: 2 },
  }]);
  const baseUrl = await serve(t, createProjectService({ projectRepository: repository }));

  const unauthenticated = await fetch(`${baseUrl}/projects/${projectId}`);
  assert.equal(unauthenticated.status, 401);

  const otherCookie = await login(baseUrl, 'other-verified');
  const hidden = await fetch(`${baseUrl}/projects/${projectId}`, { headers: { Cookie: otherCookie } });
  assert.equal(hidden.status, 404);
  assert.equal((await hidden.json()).error.code, 'PROJECT_NOT_FOUND');

  const ownerCookie = await login(baseUrl);
  const visible = await fetch(`${baseUrl}/projects/${projectId}`, { headers: { Cookie: ownerCookie } });
  assert.equal(visible.status, 200);
  assert.deepEqual(await visible.json(), {
    project: {
      id: projectId,
      status: 'processing',
      processingStage: 'transcribe',
      selectedLayout: 'SLIDE_CAM',
      customVocabulary: 'Prisma, BullMQ',
      hasSource: true,
      clipCount: 2,
      lastEditActivityAt: '2026-09-09T09:00:00.000Z',
      sourceExpiresAt: '2026-09-10T09:00:00.000Z',
      createdAt: '2026-09-09T08:00:00.000Z',
    },
  });
});

test('an owner can update layout and a normalized unique vocabulary while a project is empty', async (t) => {
  const repository = createMemoryRepository();
  const baseUrl = await serve(t, createProjectService({ projectRepository: repository }));
  const cookie = await login(baseUrl);
  const created = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: '{}',
  });
  const { project } = await created.json();

  const updated = await fetch(`${baseUrl}/projects/${project.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({
      selectedLayout: 'SLIDE_CAM',
      customVocabulary: ' Prisma, BullMQ, prisma,  Express ',
    }),
  });

  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).project, {
    ...project,
    selectedLayout: 'SLIDE_CAM',
    customVocabulary: 'Prisma, BullMQ, Express',
    lastEditActivityAt: null,
    sourceExpiresAt: null,
  });
});

test('an owner can delete only an empty project', async (t) => {
  const busyId = '44444444-4444-4444-8444-444444444444';
  const repository = createMemoryRepository([{
    id: busyId,
    userId: user.id,
    sourceVideoPath: 'private/source.mp4',
    selectedLayout: 'SLIDE_ONLY',
    customVocabulary: '',
    status: 'processing',
    processingStage: 'ingest',
    transcriptJson: null,
    lastEditActivityAt: new Date('2026-09-09T09:00:00.000Z'),
    sourceExpiresAt: new Date('2026-09-10T09:00:00.000Z'),
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    _count: { clips: 0 },
  }]);
  const baseUrl = await serve(t, createProjectService({ projectRepository: repository }));
  const cookie = await login(baseUrl);
  const created = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: '{}',
  });
  const emptyProject = (await created.json()).project;

  const blocked = await fetch(`${baseUrl}/projects/${busyId}`, {
    method: 'DELETE',
    headers: { Origin: origin, Cookie: cookie },
  });
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error.code, 'PROJECT_NOT_EMPTY');

  const removed = await fetch(`${baseUrl}/projects/${emptyProject.id}`, {
    method: 'DELETE',
    headers: { Origin: origin, Cookie: cookie },
  });
  assert.equal(removed.status, 204);

  const list = await fetch(`${baseUrl}/projects`, { headers: { Cookie: cookie } });
  assert.deepEqual((await list.json()).projects.map((project) => project.id), [busyId]);
});

test('project mutations reject invalid input, unsafe state, and untrusted requests', async (t) => {
  const busyId = '55555555-5555-4555-8555-555555555555';
  const repository = createMemoryRepository([{
    id: busyId,
    userId: user.id,
    sourceVideoPath: 'private/source.mp4',
    selectedLayout: 'SLIDE_CAM',
    customVocabulary: '',
    status: 'processing',
    processingStage: 'ingest',
    transcriptJson: null,
    lastEditActivityAt: new Date('2026-09-09T09:00:00.000Z'),
    sourceExpiresAt: new Date('2026-09-10T09:00:00.000Z'),
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    _count: { clips: 0 },
  }]);
  const baseUrl = await serve(t, createProjectService({ projectRepository: repository }));
  const cookie = await login(baseUrl);

  const unauthenticated = await fetch(`${baseUrl}/projects`);
  assert.equal(unauthenticated.status, 401);

  const untrusted = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example', Cookie: cookie },
    body: '{}',
  });
  assert.equal(untrusted.status, 403);

  const nonEmptyCreate = await fetch(`${baseUrl}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ status: 'processing' }),
  });
  assert.equal(nonEmptyCreate.status, 400);

  const invalidLayout = await fetch(`${baseUrl}/projects/${busyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ selectedLayout: 'FREEFORM' }),
  });
  assert.equal(invalidLayout.status, 400);
  assert.equal((await invalidLayout.json()).error.code, 'INVALID_LAYOUT');

  const vocabulary = Array.from({ length: 21 }, (_, index) => `istilah-${index + 1}`).join(',');
  const tooManyTerms = await fetch(`${baseUrl}/projects/${busyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ customVocabulary: vocabulary }),
  });
  assert.equal(tooManyTerms.status, 400);
  assert.equal((await tooManyTerms.json()).error.code, 'VOCABULARY_LIMIT_EXCEEDED');

  const busyUpdate = await fetch(`${baseUrl}/projects/${busyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ selectedLayout: 'SLIDE_ONLY' }),
  });
  assert.equal(busyUpdate.status, 409);
  assert.equal((await busyUpdate.json()).error.code, 'PROJECT_NOT_EDITABLE');
});

test('project CRUD preflight allows PATCH and DELETE only for the configured frontend', async (t) => {
  const baseUrl = await serve(t, {
    list: async () => [],
    create: async () => assert.fail('must not create'),
  });
  for (const method of ['PATCH', 'DELETE']) {
    const response = await fetch(`${baseUrl}/projects/example`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.match(response.headers.get('access-control-allow-methods'), new RegExp(method));
  }
});

test('source upload uses an owned project endpoint and the legacy create-on-upload route is removed', async (t) => {
  const baseUrl = await serve(t, {
    list: async () => [],
    create: async () => assert.fail('must not create'),
  });
  const projectId = '66666666-6666-4666-8666-666666666666';

  const unauthenticated = await fetch(`${baseUrl}/projects/${projectId}/source`, {
    method: 'POST',
    headers: { Origin: origin },
  });
  assert.equal(unauthenticated.status, 401);

  const legacy = await fetch(`${baseUrl}/projects/upload`, {
    method: 'POST',
    headers: { Origin: origin },
  });
  assert.equal(legacy.status, 404);
});

test('a malformed project id is rejected before database access', async (t) => {
  const projectService = createProjectService({
    projectRepository: {
      findByIdForUser: async () => assert.fail('must not access database'),
    },
  });
  const baseUrl = await serve(t, projectService);
  const cookie = await login(baseUrl);

  const response = await fetch(`${baseUrl}/projects/not-a-uuid`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_PROJECT_ID');
});
