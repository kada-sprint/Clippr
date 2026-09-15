const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPipelineService, validateTranscript } = require('../src/services/pipeline.service');
const { createProcessor } = require('../src/workers/media.worker');
const { dispatchPending } = require('../src/queues/media.queue');
const { createUploadService } = require('../src/services/upload.service');
const { validateLayout } = require('../src/services/project.service');

const projectId = '11111111-1111-4111-8111-111111111111';
const transcript = { words: [{ word: 'Halo', start_time: 0, end_time: 1, confidence: 1 }] };

test('upload UI layout values normalize to worker layout names', () => {
  assert.equal(validateLayout('SLIDE_CAM'), 'slide-cam');
  assert.equal(validateLayout('TALKING_HEAD'), 'talking-head');
  assert.equal(validateLayout('SLIDE_ONLY'), 'slide-only');
});

test('upload returns after durable admission, without transcription', async () => {
  const events = [];
  const service = createUploadService({
    repository: {
      findUploadTarget: async () => ({ id: projectId }),
      attachSource: async () => { events.push('admitted'); return { id: projectId, status: 'processing', processingStage: 'ingest' }; },
    },
    validateVideo: async () => events.push('validated'),
    removeFile: async () => assert.fail('accepted source must remain'),
  });
  const result = await service.uploadSource({ projectId, userId: 'owner', file: { path: 'source.mp4' }, selectedLayout: 'slide-cam', customVocabulary: '' });
  assert.equal(result.status, 'processing');
  assert.deepEqual(events, ['validated', 'admitted']);
});

test('failed admission removes only unaccepted source and surfaces error', async () => {
  const removed = [];
  const service = createUploadService({
    repository: { findUploadTarget: async () => ({ id: projectId }), attachSource: async () => { throw new Error('database down'); } },
    validateVideo: async () => {}, removeFile: async (file) => removed.push(file),
  });
  await assert.rejects(service.uploadSource({ projectId, userId: 'owner', file: { path: 'source.mp4' }, selectedLayout: 'slide-cam', customVocabulary: '' }), /database down/);
  assert.deepEqual(removed, ['source.mp4']);
});

test('dispatcher replays durable intent and never adds an existing job twice', async () => {
  const records = [{ id: 'job', projectId, kind: 'pipeline' }];
  const added = [];
  const queue = {
    getJob: async () => added.length ? { getState: async () => 'waiting' } : null,
    add: async (...args) => added.push(args),
  };
  const repository = { listUnfinished: async () => records };
  await dispatchPending(queue, repository);
  await dispatchPending(queue, repository);
  assert.equal(added.length, 1);
  assert.deepEqual(added[0], ['pipeline', { jobId: 'job', projectId }, { jobId: 'job' }]);
});

test('transcript validation rejects missing or invalid word timestamps', () => {
  validateTranscript(transcript);
  for (const invalid of [{ words: [] }, { words: [{ word: 'Halo', start_time: 2, end_time: 1, confidence: 1 }] }, { words: [{ word: 'Halo', start_time: 0, end_time: 1 }] }]) {
    assert.throws(() => validateTranscript(invalid), { code: 'INVALID_TRANSCRIPT' });
  }
});

test('resume after curation skips ASR/LLM and already rendered clips', async () => {
  const rendered = [];
  const updates = [];
  const job = { id: 'job', kind: 'pipeline', checkpoint: 'analyze', attemptToken: 'token',
    project: { id: projectId, sourceVideoPath: 'source.mp4' } };
  const transaction = {
    project: { update: async () => ({}) },
    processingJob: { update: async ({ data }) => updates.push(data) },
    clip: {
      findMany: async () => [{ id: 'done', status: 'rendered' }, { id: 'remaining', status: 'error' }],
      update: async () => ({}),
    },
  };
  const process = createPipelineService({
    repository: { guarded: async (id, token, action) => action(transaction) },
    files: { access: async () => {} },
    extract: async () => assert.fail('must not rerun ASR'), curate: async () => assert.fail('must not rerun curation'),
    render: async (project, clip) => { rendered.push(clip.id); return { status: 'rendered' }; },
  });
  await process(job);
  assert.deepEqual(rendered, ['remaining']);
  assert.equal(updates.at(-1).status, 'completed');
});

test('rerender reads only the requested clip and does not change project completion', async () => {
  const job = { id: 'job', kind: 'render-clip', clipId: 'clip', clip: { projectId },
    project: { id: projectId, sourceVideoPath: 'source.mp4' }, attemptToken: 'token' };
  const process = createPipelineService({
    repository: { guarded: async (id, token, action) => action({
      project: { update: async () => assert.fail('rerender must not reset project') },
      processingJob: { update: async () => ({}) },
      clip: {
        findMany: async ({ where }) => { assert.deepEqual(where, { id: 'clip', projectId }); return [{ id: 'clip', status: 'rendering' }]; },
        update: async () => ({}),
      },
    }) },
    files: { access: async () => {} },
    render: async () => ({ status: 'rendered' }),
    transcribe: async () => assert.fail('no ASR'), curate: async () => assert.fail('no curation'),
  });
  await process(job);
  await assert.rejects(process({ ...job, clip: { projectId: 'another-project' } }), { code: 'CLIP_NOT_FOUND' });
});

test('processor retries transient failures but stops invalid input and third failure', async () => {
  for (const [status, attempts, terminal] of [[503, 1, false], [422, 1, true], [503, 3, true]]) {
    let failed;
    const process = createProcessor({
      jobs: { claim: async () => ({ id: 'job', projectId, kind: 'pipeline', attempts, attemptToken: 'token' }),
        fail: async (...args) => { failed = args; } },
      processJob: async () => { throw Object.assign(new Error('test'), { status, code: 'TEST_FAILURE' }); },
    });
    await assert.rejects(process({ id: 'job', name: 'pipeline', data: { jobId: 'job', projectId } }));
    assert.equal(failed[3], terminal);
  }
});
