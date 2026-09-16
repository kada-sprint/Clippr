const fs = require('node:fs/promises');
const AppError = require('../utils/app-error');
const jobs = require('../models/processing-job.model');
const { extractAudio } = require('../utils/ffmpeg');
const { transcribeAudioChunked } = require('./stt.service');
const { curateClips, insertClips } = require('./curation.service');
const { renderMedia } = require('./render.service');
const env = require('../config/env');

function validateTranscript(transcript) {
  if (!Array.isArray(transcript?.words) || !transcript.words.length || transcript.words.some((word) =>
    typeof word.word !== 'string' || !word.word.trim() || !Number.isFinite(word.start_time) ||
    !Number.isFinite(word.end_time) || word.start_time < 0 || word.end_time <= word.start_time ||
    !Number.isFinite(word.confidence) || word.confidence < 0 || word.confidence > 1)) {
    throw new AppError(422, 'INVALID_TRANSCRIPT', 'Transkrip per kata tidak valid.');
  }
}

function createPipelineService({ repository = jobs, extract = extractAudio, transcribe = transcribeAudioChunked,
  curate = curateClips, render = renderMedia, files = fs } = {}) {
  return async function processJob(job) {
    const guard = (action) => repository.guarded(job.id, job.attemptToken, action);
    const project = job.project;
    if (job.clipId && (!job.clip || job.clip.projectId !== project.id)) {
      throw new AppError(404, 'CLIP_NOT_FOUND', 'Relasi klip dan proyek tidak valid.');
    }
    if (!project.sourceVideoPath) throw new AppError(400, 'SOURCE_MISSING', 'Upload ulang sumber diperlukan.');
    const sourceVideoPath = env.resolveMediaPath(project.sourceVideoPath);
    try { await files.access(sourceVideoPath); }
    catch { throw new AppError(400, 'SOURCE_MISSING', 'Upload ulang sumber diperlukan.'); }

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
      const result = await render(project, clip, job.attemptToken);
      await guard((transaction) => transaction.clip.update({ where: { id: clip.id }, data: result }));
    }
    await guard(async (transaction) => {
      await transaction.processingJob.update({ where: { id: job.id }, data: { status: 'completed', attemptToken: null, errorCode: null } });
      if (job.kind === 'pipeline') await transaction.project.update({ where: { id: project.id }, data: { status: 'idle', processingStage: null } });
    });
  };
}

module.exports = { createPipelineService, validateTranscript };
