const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { createMediaService } = require('../src/services/media.service');
const { createClipService } = require('../src/services/clip.service');
const { createProjectMediaCleanup } = require('../src/services/project-media-cleanup');
const { createRetentionService } = require('../src/services/retention.service');

const projectId = '11111111-1111-4111-8111-111111111111';
const clipId = '22222222-2222-4222-8222-222222222222';

test('authenticated R2 preview resolves to a short private URL without exposing a path', async () => {
  const key = `exports/${projectId}/${clipId}/subtitled.mp4`;
  const service = createMediaService({
    clipRepository: { async findByIdWithOwnership(id, userId) {
      assert.equal(id, clipId); assert.equal(userId, 'owner');
      return { id: clipId, subtitledVideoPath: key, project: { id: projectId } };
    } },
    projectRepository: {},
    objectStorage: { async createDownloadUrl(input) {
      assert.deepEqual(input, { key, expiresIn: 300 });
      return 'https://signed.example/preview';
    } },
  });
  assert.deepEqual(await service.resolveAndVerify('owner', projectId, clipId, 'subtitled.mp4'), {
    url: 'https://signed.example/preview', contentType: 'video/mp4',
  });
});

test('R2 exports use ownership-checked short URLs and download filenames', async () => {
  const videoKey = `exports/${projectId}/${clipId}/subtitled.mp4`;
  const srtKey = `exports/${projectId}/${clipId}/subtitles.srt`;
  const signed = [];
  const service = createClipService({
    clipRepository: { async findByIdWithOwnership() {
      return {
        id: clipId, title: 'Materi Prisma', status: 'rendered',
        subtitledVideoPath: videoKey, clipVideoPath: null, srtPath: srtKey,
        project: { id: projectId, status: 'idle' },
      };
    } },
    projectRepository: {},
    objectStorage: { async createDownloadUrl(input) { signed.push(input); return `https://signed.example/${signed.length}`; } },
  });
  assert.equal((await service.exportMp4('owner', clipId)).url, 'https://signed.example/1');
  assert.equal((await service.exportSrt('owner', clipId)).url, 'https://signed.example/2');
  assert.match(signed[0].responseContentDisposition, /materi-prisma\.mp4/);
  assert.match(signed[1].responseContentDisposition, /materi-prisma\.srt/);
});

test('project deletion validates and removes only its known R2 object keys', async () => {
  const deleted = [];
  const cleanup = createProjectMediaCleanup({
    mediaRoot: os.tmpdir(),
    objectStorage: { async delete(key) { deleted.push(key); } },
  });
  await cleanup({
    id: projectId,
    sourceVideoPath: `sources/${projectId}/upload.mp4`,
    clips: [{
      id: clipId,
      clipVideoPath: `exports/${projectId}/${clipId}/vertical.mp4`,
      subtitledVideoPath: `exports/${projectId}/${clipId}/subtitled.mp4`,
      srtPath: `exports/${projectId}/${clipId}/subtitles.srt`,
    }],
  });
  assert.deepEqual(deleted.sort(), [
    `exports/${projectId}/${clipId}/subtitled.mp4`,
    `exports/${projectId}/${clipId}/subtitles.srt`,
    `exports/${projectId}/${clipId}/vertical.mp4`,
    `sources/${projectId}/upload.mp4`,
  ].sort());
  await assert.rejects(cleanup({
    id: projectId,
    sourceVideoPath: `sources/another-project/upload.mp4`,
    clips: [],
  }), { code: 'UNSAFE_MEDIA_PATH' });
});

test('retention deletes an expired R2 object before clearing its database key', async () => {
  const events = [];
  const now = new Date('2026-09-17T10:00:00.000Z');
  const candidate = {
    id: projectId, kind: 'source', path: `sources/${projectId}/upload.mp4`,
    expiresAt: new Date('2026-09-17T09:00:00.000Z'),
  };
  const service = createRetentionService({
    mediaRoot: os.tmpdir(), clock: () => now,
    objectStorage: { async delete(key) { events.push(`delete:${key}`); } },
    repository: {
      async listExpired() { return [candidate]; },
      async withCleanupClaim(item, time, callback) {
        assert.equal(item, candidate); assert.equal(time, now);
        await callback({ media: candidate, clearPath: async () => events.push('clear') });
      },
    },
  });
  assert.deepEqual(await service.runOnce(), [{ id: projectId, kind: 'source', status: 'cleaned' }]);
  assert.deepEqual(events, [`delete:${candidate.path}`, 'clear']);
});
