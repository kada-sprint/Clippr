const { getPrisma } = require('../config/prisma');

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
  const prisma = getPrisma();
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
  return findUploadTarget(id, userId);
}

async function markTranscribing(id, userId) {
  return getPrisma().project.update({
    where: { id, userId },
    data: { status: 'processing', processingStage: 'transcribe' },
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
  return getPrisma().project.update({
    where: { id, userId },
    data: { status: 'error', processingStage },
    select: { id: true },
  });
}

module.exports = {
  findUploadTarget,
  attachSource,
  markTranscribing,
  saveTranscript,
  markFailed,
};
