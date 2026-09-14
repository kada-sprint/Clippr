const { getPrisma } = require('../config/prisma');
const { withProjectLock } = require('./project-lock');

const uploadProjectSelect = {
  id: true,
  userId: true,
  sourceVideoPath: true,
  selectedLayout: true,
  customVocabulary: true,
  status: true,
  processingStage: true,
  transcriptJson: true,
  lastEditActivityAt: true,
  sourceExpiresAt: true,
  createdAt: true,
  _count: { select: { clips: true } },
};

async function findUploadTarget(id, userId) {
  return getPrisma().project.findFirst({
    where: { id, userId },
    select: uploadProjectSelect,
  });
}

async function attachSource({ id, userId, sourceVideoPath, selectedLayout, customVocabulary }) {
  return withProjectLock(id, userId, async (prisma) => {
    const now = new Date();
    const updated = await prisma.project.updateMany({
      where: { id, userId, sourceVideoPath: null, status: 'idle', processingStage: null },
      data: {
        sourceVideoPath,
        selectedLayout,
        customVocabulary,
        status: 'processing',
        processingStage: 'ingest',
        lastEditActivityAt: now,
        sourceExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    if (updated.count !== 1) return null;
    return prisma.project.findFirst({ where: { id, userId }, select: uploadProjectSelect });
  });
}

async function markTranscribing(id, userId) {
  return getPrisma().project.update({
    where: { id, userId },
    data: { status: 'processing', processingStage: 'transcribe' },
    select: uploadProjectSelect,
  });
}

async function markCurating(id, userId) {
  return getPrisma().project.update({
    where: { id, userId },
    data: { status: 'processing', processingStage: 'curate' },
    select: uploadProjectSelect,
  });
}

async function saveTranscript(id, userId, transcriptJson) {
  return getPrisma().project.update({
    where: { id, userId },
    data: { status: 'TRANSCRIBED', processingStage: 'transcribe', transcriptJson },
    select: uploadProjectSelect,
  });
}

async function markFailed(id, userId, processingStage) {
  // Curation can report failure twice. A late callback must not revive a
  // project whose deletion has already been admitted (or has finished).
  return getPrisma().project.updateMany({
    where: { id, userId, status: { not: 'deleting' } },
    data: { status: 'error', processingStage },
  });
}

module.exports = {
  findUploadTarget,
  attachSource,
  markTranscribing,
  markCurating,
  saveTranscript,
  markFailed,
};
