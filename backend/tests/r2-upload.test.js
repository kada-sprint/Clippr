const test = require('node:test');
const assert = require('node:assert/strict');
const { createUploadService } = require('../src/services/upload.service');

const projectId = '11111111-1111-4111-8111-111111111111';

function project(overrides = {}) {
  return {
    id: projectId,
    userId: 'owner',
    sourceVideoPath: null,
    selectedLayout: 'slide-cam',
    customVocabulary: 'Prisma',
    status: 'idle',
    processingStage: null,
    transcriptJson: null,
    lastEditActivityAt: null,
    sourceExpiresAt: null,
    createdAt: new Date('2026-09-17T00:00:00.000Z'),
    _count: { clips: 0 },
    ...overrides,
  };
}

test('initiate creates an empty project and returns a private R2 upload contract', async () => {
  let row = project({ selectedLayout: null, customVocabulary: '' });
  const service = createUploadService({
    repository: {},
    projectRepository: {
      async createForUser(userId) { assert.equal(userId, 'owner'); return row; },
      async updateSetupIfEmpty(id, userId, data) {
        assert.equal(id, projectId); assert.equal(userId, 'owner');
        row = { ...row, ...data };
        return { state: 'updated', project: row };
      },
      async deleteEmpty() { assert.fail('successful initiation must not delete the project'); },
    },
    objectStorage: {
      async createUploadUrl({ key, contentType }) {
        assert.match(key, new RegExp(`^sources/${projectId}/[0-9a-f-]+\\.mp4$`));
        assert.equal(contentType, 'video/mp4');
        return { url: 'https://signed.example/upload', headers: { 'Content-Type': contentType } };
      },
    },
  });

  const result = await service.initiate({
    userId: 'owner',
    body: {
      file_name: 'lesson.mp4', file_size: 1024, mime_type: 'video/mp4',
      selected_layout: 'SLIDE_CAM', custom_vocabulary: 'Prisma, prisma',
    },
  });
  assert.equal(result.project.selectedLayout, 'slide-cam');
  assert.equal(result.project.customVocabulary, 'Prisma');
  assert.equal(result.upload.url, 'https://signed.example/upload');
  assert.equal(result.upload.expiresIn, 900);
});

test('initiate validates media before creating a project and removes an empty project if signing fails', async () => {
  let created = 0;
  let deleted = 0;
  const projectRepository = {
    async createForUser() { created++; return project(); },
    async updateSetupIfEmpty() { return { state: 'updated', project: project() }; },
    async deleteEmpty(id, userId) { assert.equal(id, projectId); assert.equal(userId, 'owner'); deleted++; },
  };
  const service = createUploadService({
    repository: {}, projectRepository,
    objectStorage: { async createUploadUrl() { throw new Error('R2 unavailable'); } },
  });

  await assert.rejects(
    service.initiate({ userId: 'owner', body: {
      file_name: 'lesson.exe', file_size: 10, mime_type: 'application/octet-stream',
      selected_layout: 'slide-cam', custom_vocabulary: '',
    } }),
    (error) => error.code === 'INVALID_FILE_TYPE',
  );
  assert.equal(created, 0);
  await assert.rejects(
    service.initiate({ userId: 'owner', body: {
      file_name: 'lesson.mp4', file_size: 10, mime_type: 'video/mp4',
      selected_layout: 'slide-cam', custom_vocabulary: '',
    } }),
    (error) => error.code === 'UPLOAD_STORAGE_UNAVAILABLE',
  );
  assert.equal(deleted, 1);
});

test('complete verifies ownership and R2 metadata before durable admission', async () => {
  const key = `sources/${projectId}/upload.mp4`;
  let row = project();
  let attached = 0;
  const repository = {
    async findUploadTarget(id, userId) {
      assert.equal(id, projectId); assert.equal(userId, 'owner'); return row;
    },
    async attachSource(input) {
      attached++;
      assert.equal(input.sourceVideoPath, key);
      row = project({ sourceVideoPath: key, status: 'processing', processingStage: 'ingest' });
      return row;
    },
  };
  const service = createUploadService({
    repository,
    projectRepository: {},
    objectStorage: { async head(objectKey) {
      assert.equal(objectKey, key);
      return { contentLength: 1024, contentType: 'video/mp4' };
    } },
  });

  const first = await service.complete({ projectId, userId: 'owner', body: { object_key: key } });
  const repeated = await service.complete({ projectId, userId: 'owner', body: { object_key: key } });
  assert.equal(first.processingStage, 'ingest');
  assert.equal(repeated.processingStage, 'ingest');
  assert.equal(attached, 1);
});

test('complete rejects foreign keys, missing projects, and invalid R2 metadata', async () => {
  const base = { projectId, userId: 'owner' };
  const missing = createUploadService({
    repository: { async findUploadTarget() { return null; } }, projectRepository: {}, objectStorage: {},
  });
  await assert.rejects(
    missing.complete({ ...base, body: { object_key: `sources/${projectId}/video.mp4` } }),
    (error) => error.code === 'PROJECT_NOT_FOUND',
  );

  const invalid = createUploadService({
    repository: { async findUploadTarget() { return project(); } },
    projectRepository: {},
    objectStorage: { async head() { return { contentLength: 0, contentType: 'video/mp4' }; } },
  });
  await assert.rejects(
    invalid.complete({ ...base, body: { object_key: 'sources/other/video.mp4' } }),
    (error) => error.code === 'INVALID_UPLOAD_KEY',
  );
  await assert.rejects(
    invalid.complete({ ...base, body: { object_key: `sources/${projectId}/video.mp4` } }),
    (error) => error.code === 'INVALID_UPLOADED_OBJECT',
  );
});
