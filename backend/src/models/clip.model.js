const { getPrisma } = require('../config/prisma');
const { withProjectLock } = require('./project-lock');
const AppError = require('../utils/app-error');

const clipSelect = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  clipVideoPath: true,
  subtitledVideoPath: true,
  status: true,
  subtitleStyle: true,
  horizontalOffset: true,
  project: { select: { selectedLayout: true } },
};

const clipSelectDetail = {
  ...clipSelect,
  transcriptJson: true,
  subtitleStyle: true,
  conceptScore: true,
  pedagogicalReason: true,
};

async function findManyByProjectId(projectId) {
  return getPrisma().clip.findMany({
    where: { projectId },
    orderBy: { conceptScore: 'desc' },
    select: clipSelect,
  });
}

async function findByIdWithOwnership(clipId, userId) {
  return getPrisma().clip.findFirst({
    where: {
      id: clipId,
      project: { userId },
    },
    select: {
      ...clipSelectDetail,
      project: { select: { id: true, userId: true } },
    },
  });
}

async function findById(clipId) {
  return getPrisma().clip.findUnique({
    where: { id: clipId },
    select: clipSelectDetail,
  });
}

async function findTranscriptById(clipId) {
  return getPrisma().clip.findUnique({
    where: { id: clipId },
    select: { id: true, transcriptJson: true },
  });
}

async function updateById(clipId, data) {
  return getPrisma().clip.update({
    where: { id: clipId },
    data,
    select: clipSelectDetail,
  });
}

async function claimRender(clipId, userId) {
  const target = await findByIdWithOwnership(clipId, userId);
  if (!target) throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');
  return withProjectLock(target.project.id, userId, async (transaction) => {
    const clip = await transaction.clip.findFirst({
      where: { id: clipId, project: { userId } },
      select: { ...clipSelectDetail, project: { select: { id: true, sourceVideoPath: true, selectedLayout: true, status: true } } },
    });
    if (!clip) throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');
    if (clip.status === 'rendering') throw new AppError(409, 'ALREADY_RENDERING', 'Klip sedang dalam proses render.');
    if (!['idle', 'error'].includes(clip.project.status)) throw new AppError(409, 'PROJECT_BUSY', 'Proyek sedang diproses.');
    if (!clip.project.sourceVideoPath) throw new AppError(400, 'SOURCE_MISSING', 'Sumber video tidak tersedia. Upload ulang diperlukan.');
    await transaction.clip.update({ where: { id: clipId }, data: { status: 'rendering' } });
    return clip;
  });
}

module.exports = {
  findManyByProjectId,
  findByIdWithOwnership,
  findById,
  findTranscriptById,
  updateById,
  claimRender,
};
