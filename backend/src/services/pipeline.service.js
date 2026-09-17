const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const AppError = require('../utils/app-error');
const jobs = require('../models/processing-job.model');
const { extractAudio } = require('../utils/ffmpeg');
const { transcribeAudioChunked } = require('./stt.service');
const { curateClips, insertClips } = require('./curation.service');
const { renderMedia } = require('./render.service');
const env = require('../config/env');
const { createObjectStorage } = require('./object-storage.service');

function validateTranscript(transcript) {
  if (!Array.isArray(transcript?.words) || !transcript.words.length || transcript.words.some((word) =>
    typeof word.word !== 'string' || !word.word.trim() || !Number.isFinite(word.start_time) ||
    !Number.isFinite(word.end_time) || word.start_time < 0 || word.end_time <= word.start_time ||
    !Number.isFinite(word.confidence) || word.confidence < 0 || word.confidence > 1)) {
    throw new AppError(422, 'INVALID_TRANSCRIPT', 'Transkrip per kata tidak valid.');
  }
}

function createPipelineService({ repository = jobs, extract = extractAudio, transcribe = transcribeAudioChunked,
  curate = curateClips, render = renderMedia, files = fs, objectStorage,
  objectStorageFactory = createObjectStorage } = {}) {
  return async function processJob(job) {
    const guard = (action) => repository.guarded(job.id, job.attemptToken, action);
    const project = job.project;
    if (job.clipId && (!job.clip || job.clip.projectId !== project.id)) {
      throw new AppError(404, 'CLIP_NOT_FOUND', 'Relasi klip dan proyek tidak valid.');
    }
    if (!project.sourceVideoPath) throw new AppError(400, 'SOURCE_MISSING', 'Upload ulang sumber diperlukan.');
    const storedInR2 = project.sourceVideoPath.startsWith('sources/');
    let storage = objectStorage;
    let temporaryRoot;
    let sourceVideoPath;
    if (storedInR2) {
      storage ||= objectStorageFactory();
      temporaryRoot = await files.mkdtemp(path.join(os.tmpdir(), 'cuplik-worker-'));
      sourceVideoPath = path.join(temporaryRoot, `source${path.extname(project.sourceVideoPath).toLowerCase()}`);
      try { await storage.downloadToFile(project.sourceVideoPath, sourceVideoPath); }
      catch {
        await files.rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
        throw new AppError(400, 'SOURCE_MISSING', 'Upload ulang sumber diperlukan.');
      }
    } else {
      sourceVideoPath = env.resolveMediaPath(project.sourceVideoPath);
      try { await files.access(sourceVideoPath); }
      catch { throw new AppError(400, 'SOURCE_MISSING', 'Upload ulang sumber diperlukan.'); }
    }

    try {

    async function stage(processingStage) {
      console.log(JSON.stringify({ jobId: job.id, projectId: job.projectId, stage: processingStage, attempt: job.attempts }));
      await guard((transaction) => transaction.project.update({ where: { id: project.id },
        data: { status: 'processing', processingStage } }));
    }

    if (job.kind === 'pipeline') {
      if (!job.checkpoint) {
        await stage('ingest');
        let audio;
        let transcript;
        try {
          audio = await extract(sourceVideoPath);
          await stage('transcribe');
          transcript = await transcribe(audio, project.customVocabulary);
          validateTranscript(transcript);
        } finally {
          if (audio) await files.unlink(audio).catch((error) => { if (error.code !== 'ENOENT') console.error('[Worker] Cleanup audio gagal.'); });
        }
        await guard(async (transaction) => {
          await transaction.project.update({ where: { id: project.id }, data: { transcriptJson: transcript } });
          await transaction.processingJob.update({ where: { id: job.id }, data: { checkpoint: 'transcribe' } });
        });
        project.transcriptJson = transcript;
        job.checkpoint = 'transcribe';
      }
      if (job.checkpoint === 'transcribe') {
        await stage('analyze');
        const segments = await curate(project.id, project.transcriptJson, {
          recordLlmCall: (data) => guard((transaction) => transaction.llmCall.create({ data })),
        });
        await guard(async (transaction) => {
          await insertClips(transaction, project.id, segments, project.transcriptJson.words, false);
          await transaction.processingJob.update({ where: { id: job.id }, data: { checkpoint: 'analyze' } });
        });
      }
      await stage('render');
    }

    const clips = await guard((transaction) => transaction.clip.findMany({
      where: { projectId: project.id, ...(job.clipId ? { id: job.clipId } : {}) }, orderBy: { id: 'asc' },
    }));
    if (!clips.length) throw new AppError(422, 'CLIPS_MISSING', 'Klip untuk render tidak tersedia.');
    for (const clip of clips) {
      if (job.kind === 'pipeline' && clip.status === 'rendered') continue;
      await guard((transaction) => transaction.clip.update({ where: { id: clip.id }, data: { status: 'rendering' } }));
      let result = await render(project, clip, job.attemptToken, {
        sourceVideoPath,
        ...(temporaryRoot ? { outputDirectory: path.join(temporaryRoot, clip.id) } : {}),
      });
      if (storedInR2) {
        const prefix = `exports/${project.id}/${clip.id}`;
        const uploads = [
          ['clipVideoPath', 'vertical.mp4', 'video/mp4'],
          ['subtitledVideoPath', 'subtitled.mp4', 'video/mp4'],
          ['srtPath', 'subtitles.srt', 'application/x-subrip'],
        ];
        const persisted = { ...result };
        for (const [field, name, contentType] of uploads) {
          if (!result[field]) continue;
          const key = `${prefix}/${name}`;
          await storage.uploadFile({ key, filePath: result[field], contentType });
          persisted[field] = key;
        }
        result = persisted;
      }
      await guard((transaction) => transaction.clip.update({ where: { id: clip.id }, data: result }));
      if (!storedInR2 && result.clipVideoPath) {
        await files.unlink(result.clipVideoPath).catch(() => {});
      }
    }
    await guard(async (transaction) => {
      await transaction.processingJob.update({ where: { id: job.id }, data: { status: 'completed', attemptToken: null, errorCode: null } });
      await transaction.project.update({ where: { id: project.id }, data: { status: 'idle', processingStage: null } });
    });
    } finally {
      if (temporaryRoot) {
        await files.rm(temporaryRoot, { recursive: true, force: true }).catch((error) => {
          console.error('[Worker] Cleanup direktori sementara gagal:', error.message);
        });
      }
    }
  };
}

module.exports = { createPipelineService, validateTranscript };
